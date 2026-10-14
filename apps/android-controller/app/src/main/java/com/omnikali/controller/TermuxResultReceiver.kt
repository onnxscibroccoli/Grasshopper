package com.omnikali.controller

import android.app.Activity
import android.app.BroadcastOptions
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import org.json.JSONObject
import java.security.MessageDigest

class TermuxResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != ACTION_TERMUX_RESULT) return
        val jobId = intent.getStringExtra(EXTRA_JOB_ID).orEmpty()
        val result = intent.getBundleExtra(EXTRA_RESULT_BUNDLE)
        val checked = verifyResult(result)

        context.getSharedPreferences("controller_state", Context.MODE_PRIVATE).edit()
            .putString("last_probe_state", checked.status)
            .putString("last_probe_detail", checked.detail)
            .putLong("last_probe_updated_at_ms", System.currentTimeMillis())
            .apply()

        if (jobId.isNotBlank()) {
            if (jobId.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) {
                val ledger = JobLedger(context)
                try {
                    val outcome = if (checked.status == "PROOF_VERIFIED") "PROOF_VERIFIED" else "FAILED"
                    val digest = sha256(checked.json.toByteArray(Charsets.UTF_8))
                    ledger.completeWithProof(jobId, outcome, checked.status, checked.detail, checked.json, digest)
                } catch (e: Exception) {
                    context.getSharedPreferences("controller_state", Context.MODE_PRIVATE).edit()
                        .putString("last_probe_detail", "Result received but durable job recording failed: " + (e.message ?: e.javaClass.simpleName).take(300))
                        .apply()
                } finally {
                    ledger.close()
                }
            }

            val resultIntent = Intent(ACTION_RESULT_READY)
                .setPackage(context.packageName)
                .putExtra(EXTRA_JOB_ID, jobId)
                .putExtra(EXTRA_RESULT_STATUS, checked.status)
                .putExtra(EXTRA_RESULT_JSON, checked.json)
                .putExtra(EXTRA_RESULT_DETAIL, checked.detail)
            context.sendBroadcast(resultIntent)
        } else {
            postLocalResultNotification(context, checked.status, checked.detail)
        }
    }

    private data class CheckedResult(
        val status: String,
        val detail: String,
        val json: String
    )

    private fun verifyResult(bundle: Bundle?): CheckedResult {
        if (bundle == null) return notProven("Termux result bundle is missing", null)
        val internalError = bundle.getInt(EXTRA_TERMUX_ERR, Int.MIN_VALUE)
        val exitCode = bundle.getInt(EXTRA_TERMUX_EXIT_CODE, Int.MIN_VALUE)
        val stdout = bundle.getString(EXTRA_TERMUX_STDOUT).orEmpty().take(MAX_OUTPUT_CHARS)
        val stderr = bundle.getString(EXTRA_TERMUX_STDERR).orEmpty().take(MAX_OUTPUT_CHARS)
        val originalOut = bundle.getString(EXTRA_TERMUX_STDOUT_LENGTH)?.toLongOrNull()
        val originalErr = bundle.getString(EXTRA_TERMUX_STDERR_LENGTH)?.toLongOrNull()
        val stdoutDigest = sha256(stdout.toByteArray(Charsets.UTF_8))
        val stderrDigest = sha256(stderr.toByteArray(Charsets.UTF_8))

        if (internalError != Activity.RESULT_OK) {
            return notProven("Termux reported internal command error code $internalError", evidenceJson(
                "NOT_PROVEN", internalError, exitCode, stdoutDigest, stderrDigest, null, null, null
            ))
        }
        if (exitCode != 0) {
            return notProven("Canonical Rish probe exit code was $exitCode", evidenceJson(
                "NOT_PROVEN", internalError, exitCode, stdoutDigest, stderrDigest, null, null, null
            ))
        }
        if ((originalOut != null && originalOut > stdout.length) ||
            (originalErr != null && originalErr > stderr.length)
        ) {
            return notProven("Termux truncated command output; evidence is incomplete", evidenceJson(
                "NOT_PROVEN", internalError, exitCode, stdoutDigest, stderrDigest, null, null, null
            ))
        }
        if (!stdout.lineSequence().any { it.trim() == "RISH_TRANSPORT_PASS" }) {
            return notProven("Canonical RISH_TRANSPORT_PASS marker is missing", evidenceJson(
                "NOT_PROVEN", internalError, exitCode, stdoutDigest, stderrDigest, null, null, null
            ))
        }
        val marker = Regex("(?m)^RDC_RISH_TARGET_OK_[a-f0-9]{16}\r?$")
            .find(stdout)?.value?.trim()
        if (marker == null) {
            return notProven("Rish target nonce marker is missing", evidenceJson(
                "NOT_PROVEN", internalError, exitCode, stdoutDigest, stderrDigest, null, null, null
            ))
        }
        if (!stdout.contains("uid=2000(shell)")) {
            return notProven("Android shell UID proof is missing", evidenceJson(
                "NOT_PROVEN", internalError, exitCode, stdoutDigest, stderrDigest, marker, null, null
            ))
        }
        val artifact = Regex("(?m)^artifact=((/sdcard/|/storage/emulated/0/)[^\r\n]{1,512})\r?$")
            .find(stdout)?.groupValues?.getOrNull(1)
        if (artifact == null || artifact.contains("..")) {
            return notProven("Shared-storage artifact path is missing or unsafe", evidenceJson(
                "NOT_PROVEN", internalError, exitCode, stdoutDigest, stderrDigest, marker, null, null
            ))
        }
        val sdk = Regex("(?m)^([0-9]{2,3})\r?$").findAll(stdout)
            .mapNotNull { it.groupValues.getOrNull(1)?.toIntOrNull() }
            .firstOrNull { it in 26..99 }
        if (sdk == null) {
            return notProven("Android SDK proof is missing", evidenceJson(
                "NOT_PROVEN", internalError, exitCode, stdoutDigest, stderrDigest, marker, artifact, null
            ))
        }

        val json = evidenceJson("PASS", internalError, exitCode, stdoutDigest, stderrDigest, marker, artifact, sdk)
        return CheckedResult(
            "PROOF_VERIFIED",
            "Canonical Rish probe returned the success marker, uid=2000(shell), SDK $sdk, and a non-empty shared-storage artifact check.",
            json
        )
    }

    private fun notProven(reason: String, supplied: String?): CheckedResult {
        val json = supplied ?: JSONObject()
            .put("status", "NOT_PROVEN")
            .put("reason", reason)
            .toString()
        return CheckedResult("NOT_PROVEN", reason.take(500), json.take(MAX_RESULT_JSON_CHARS))
    }

    private fun evidenceJson(
        status: String,
        internalError: Int,
        exitCode: Int,
        stdoutSha256: String,
        stderrSha256: String,
        marker: String?,
        artifact: String?,
        sdk: Int?
    ): String {
        val out = JSONObject()
            .put("status", status)
            .put("termuxInternalError", internalError)
            .put("exitCode", exitCode)
            .put("stdoutSha256", stdoutSha256)
            .put("stderrSha256", stderrSha256)
        if (marker != null) out.put("targetMarker", marker)
        if (artifact != null) out.put("artifactPath", artifact)
        if (sdk != null) out.put("androidSdk", sdk)
        return out.toString().take(MAX_RESULT_JSON_CHARS)
    }

    private fun sha256(bytes: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    private fun postLocalResultNotification(context: Context, state: String, detail: String) {
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, context.getString(R.string.notification_channel_name), NotificationManager.IMPORTANCE_LOW)
            )
        }
        val pending = android.app.PendingIntent.getActivity(
            context,
            27141,
            Intent(context, MainActivity::class.java).setData(android.net.Uri.parse("omnikali://controller/status")),
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        try {
            manager.notify(
                LOCAL_NOTIFICATION_ID,
                androidx.core.app.NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_notify_sync)
                    .setContentTitle("Rish proof: $state")
                    .setContentText(detail.take(120))
                    .setStyle(androidx.core.app.NotificationCompat.BigTextStyle().bigText(detail))
                    .setContentIntent(pending)
                    .setAutoCancel(true)
                    .build()
            )
        } catch (_: SecurityException) {
            // Persisted proof state remains inspectable from the controller even if notifications are denied.
        }
    }

    companion object {
        const val ACTION_TERMUX_RESULT = "com.omnikali.controller.TERMUX_RESULT"
        const val ACTION_RESULT_READY = "com.omnikali.controller.RISH_RESULT_READY"
        const val EXTRA_JOB_ID = "omnikali.job_id"
        const val EXTRA_RESULT_STATUS = "omnikali.result_status"
        const val EXTRA_RESULT_JSON = "omnikali.result_json"
        const val EXTRA_RESULT_DETAIL = "omnikali.result_detail"

        const val EXTRA_RESULT_BUNDLE = "result"
        const val EXTRA_TERMUX_STDOUT = "stdout"
        const val EXTRA_TERMUX_STDERR = "stderr"
        const val EXTRA_TERMUX_EXIT_CODE = "exitCode"
        const val EXTRA_TERMUX_ERR = "err"
        const val EXTRA_TERMUX_STDOUT_LENGTH = "stdout_original_length"
        const val EXTRA_TERMUX_STDERR_LENGTH = "stderr_original_length"

        private const val CHANNEL_ID = "omnikali-controller"
        private const val LOCAL_NOTIFICATION_ID = 18422
        private const val MAX_OUTPUT_CHARS = 48 * 1024
        private const val MAX_RESULT_JSON_CHARS = 4096
    }
}
