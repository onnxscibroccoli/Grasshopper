package com.omnikali.controller

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import java.util.concurrent.atomic.AtomicInteger

object TermuxRunCommandBridge {
    const val ACTION_RUN = "com.termux.RUN_COMMAND"
    const val EXTRA_PATH = "com.termux.RUN_COMMAND_PATH"
    const val EXTRA_ARGUMENTS = "com.termux.RUN_COMMAND_ARGUMENTS"
    const val EXTRA_WORKDIR = "com.termux.RUN_COMMAND_WORKDIR"
    const val EXTRA_BACKGROUND = "com.termux.RUN_COMMAND_BACKGROUND"
    const val EXTRA_PENDING_INTENT = "com.termux.RUN_COMMAND_PENDING_INTENT"
    const val EXTRA_COMMAND_LABEL = "com.termux.RUN_COMMAND_COMMAND_LABEL"
    const val EXTRA_COMMAND_DESCRIPTION = "com.termux.RUN_COMMAND_COMMAND_DESCRIPTION"
    const val TERMUX_PACKAGE = "com.termux"

    private const val TERMUX_BASH = "/data/data/com.termux/files/usr/bin/bash"
    private const val RISH_REPOSITORY = "/data/data/com.termux/files/home/broccoli-rish"
    private const val MIN_RESULT_VERSION_MINOR = 109
    private val nextRequestCode = AtomicInteger((System.currentTimeMillis() and 0x3fffffffL).toInt())

    /**
     * Start only the canonical Rish proof script. This API never accepts a remote shell string.
     * The PendingIntent callback returns bounded stdout/stderr and Termux's exit/internal status.
     */
    fun dispatchTransportProbe(context: Context, jobId: String? = null) {
        val packageInfo = try {
            context.packageManager.getPackageInfo(TERMUX_PACKAGE, 0)
        } catch (e: Exception) {
            throw IllegalStateException("Termux is not installed or package visibility is blocked", e)
        }

        val version = packageInfo.versionName.orEmpty()
        val versionParts = Regex("^([0-9]+)\\.([0-9]+)").find(version)
            ?: throw IllegalStateException("Cannot determine Termux version; install a version >= 0.109 for result callbacks")
        val major = versionParts.groupValues[1].toIntOrNull() ?: 0
        val minor = versionParts.groupValues[2].toIntOrNull() ?: 0
        val resultSupported = major > 0 || minor >= MIN_RESULT_VERSION_MINOR
        if (!resultSupported) {
            throw IllegalStateException("Termux $version is too old for trustworthy command-result callbacks; version 0.109 or newer is required")
        }

        val executionId = nextRequestCode.updateAndGet { current ->
            if (current >= 0x3ffffffe) 1000 else current + 1
        }
        val callbackIntent = Intent(context, TermuxResultReceiver::class.java)
            .setAction(TermuxResultReceiver.ACTION_TERMUX_RESULT)
            .putExtra(TermuxResultReceiver.EXTRA_JOB_ID, jobId.orEmpty())
            .putExtra("execution_id", executionId)
        var flags = PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_CANCEL_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags = flags or PendingIntent.FLAG_MUTABLE
        val callback = PendingIntent.getBroadcast(context, executionId, callbackIntent, flags)

        val command = "RISH_PRESERVE_ENV=0 bash ./lib/rish_transport_probe.sh"
        val intent = Intent(ACTION_RUN).apply {
            component = ComponentName(TERMUX_PACKAGE, "com.termux.app.RunCommandService")
            putExtra(EXTRA_PATH, TERMUX_BASH)
            putExtra(EXTRA_ARGUMENTS, arrayOf("-lc", command))
            putExtra(EXTRA_WORKDIR, RISH_REPOSITORY)
            putExtra(EXTRA_BACKGROUND, true)
            putExtra(EXTRA_PENDING_INTENT, callback)
            putExtra(EXTRA_COMMAND_LABEL, "OmniKali canonical Rish transport proof")
            putExtra(
                EXTRA_COMMAND_DESCRIPTION,
                "Runs the fixed broccoli-rish proof script. No arbitrary remote command is accepted."
            )
        }

        try {
            context.startService(intent)
                ?: throw IllegalStateException("Termux declined the command service request")
        } catch (e: SecurityException) {
            callback.cancel()
            throw IllegalStateException(
                "Termux external commands are not authorized. Grant this app Run commands in Termux environment permission and set allow-external-apps=true in Termux.",
                e
            )
        } catch (e: IllegalStateException) {
            callback.cancel()
            throw e
        } catch (e: Exception) {
            callback.cancel()
            throw IllegalStateException("Unable to start Termux command service", e)
        }
    }
}
