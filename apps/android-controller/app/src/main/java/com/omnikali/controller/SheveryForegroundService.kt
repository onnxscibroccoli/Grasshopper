package com.omnikali.controller

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.omnikali.protocol.v1.ServerMessage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class SheveryForegroundService : Service(), ControlPlaneEvents {
    private var client: ControlPlaneClient? = null
    private var ledger: JobLedger? = null
    private var commandExecutor: ExecutorService? = null
    private lateinit var preferences: android.content.SharedPreferences
    private val notificationId = 18420
    private val channelId = "omnikali-controller"
    @Volatile private var currentDetail = "Starting"

    override fun onCreate() {
        super.onCreate()
        preferences = getSharedPreferences("controller_endpoint", MODE_PRIVATE)
        ledger = JobLedger(this)
        commandExecutor = Executors.newSingleThreadExecutor()
        ensureNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopConnection()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf(startId)
                return START_NOT_STICKY
            }
            ACTION_START, null -> {
                ServiceCompat.startForeground(
                    this,
                    notificationId,
                    buildNotification("Starting secure connection"),
                    if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC else 0
                )
                startConnectionIfConfigured()
                return START_STICKY
            }
            else -> {
                stopSelf(startId)
                return START_NOT_STICKY
            }
        }
    }

    private fun startConnectionIfConfigured() {
        if (client != null) return
        val host = preferences.getString(KEY_HOST, null)
        val port = preferences.getInt(KEY_PORT, 443)
        if (host.isNullOrBlank() || !SecureCredentialStore.exists(this)) {
            updateConnectionState("REQUIRES_OPERATOR_ACTION", "Configure the gRPC host and import the gateway-issued mTLS identity")
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        val target = try {
            ControlPlaneTarget(host, port)
        } catch (e: Exception) {
            updateConnectionState("REQUIRES_OPERATOR_ACTION", e.message ?: "Invalid endpoint")
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        client = ControlPlaneClient(
            applicationContext,
            target,
            ControlPlaneClient.newDeviceId(this),
            this
        )
        client?.start()
    }

    override fun onConnectionState(state: String, detail: String) {
        updateConnectionState(state, detail)
        updateNotification(detail)
    }

    override fun onServerMessage(message: ServerMessage) {
        when (message.payloadCase) {
            ServerMessage.PayloadCase.WELCOME -> {
                updateConnectionState("CONNECTED", "Authenticated gRPC session; server=\${message.welcome.serverVersion}")
            }
            ServerMessage.PayloadCase.HEARTBEAT -> Unit
            ServerMessage.PayloadCase.COMMAND -> {
                commandExecutor?.execute { dispatchCommand(message.command) }
            }
            ServerMessage.PayloadCase.CANCEL -> {
                client?.sendFailure(
                    message.cancel.jobId,
                    "CANCEL_NOT_SUPPORTED",
                    "The only supported operation is a bounded diagnostic trigger; remote cancellation is not claimed after Termux dispatch.",
                    false
                )
            }
            ServerMessage.PayloadCase.PAYLOAD_NOT_SET -> {
                onProtocolViolation("Server message has no recognized payload")
            }
        }
    }

    override fun onProtocolViolation(detail: String) {
        updateConnectionState("REQUIRES_OPERATOR_ACTION", detail)
    }

    private fun dispatchCommand(command: com.omnikali.protocol.v1.JobCommand) {
        val activeClient = client ?: return
        val jobId = command.jobId
        val idem = command.idempotencyKey
        val operation = command.operation

        if (!jobId.matches(Regex("[A-Za-z0-9._:-]{1,128}")) ||
            !idem.matches(Regex("[A-Za-z0-9._:-]{1,128}"))) {
            activeClient.sendFailure(jobId, "INVALID_ID", "Job ID and idempotency key must be bounded identifiers.", false)
            return
        }

        val deadline = command.deadlineUnixMs
        val now = System.currentTimeMillis()
        if (deadline <= now || deadline - now > MAX_COMMAND_HORIZON_MS) {
            activeClient.sendFailure(jobId, "INVALID_DEADLINE", "Command is expired or exceeds the accepted deadline horizon.", false)
            return
        }

        val jobLedger = ledger ?: return
        val inserted = try {
            jobLedger.receive(jobId, idem, operation)
        } catch (e: Exception) {
            activeClient.sendFailure(jobId, "INVALID_COMMAND", e.message ?: "Command validation failed.", false)
            return
        }
        if (!inserted) {
            val existing = jobLedger.findByJobId(jobId) ?: jobLedger.findByIdempotencyKey(idem)
            activeClient.sendFailure(
                jobId,
                "DUPLICATE_FENCED",
                "The job or idempotency key was already recorded; no second dispatch was attempted. Existing state=\${existing?.state ?: "unknown"}.",
                false
            )
            return
        }

        val validProbe = operation == OP_RISH_PROBE &&
            command.requiredScope == SCOPE_RISH_PROBE &&
            command.payload.isEmpty
        if (!validProbe) {
            jobLedger.transition(jobId, "RECEIVED", "REJECTED", "Operation or scope is outside the local allowlist")
            activeClient.sendFailure(
                jobId,
                "OPERATION_NOT_ALLOWED",
                "Only android.rish.transport.probe with scope android.rish.probe and an empty payload is accepted on this client.",
                false
            )
            return
        }

        try {
            TermuxRunCommandBridge.dispatchTransportProbe(this)
            jobLedger.transition(
                jobId,
                "RECEIVED",
                "DISPATCHED_AWAITING_PROOF",
                "Termux accepted the fixed Rish probe launch; UID, SDK, output marker, and proof artifact have not been observed by this app."
            )
            activeClient.sendAccepted(jobId, "DISPATCHED_AWAITING_PROOF")
            updateConnectionState(
                "CONNECTED",
                "Diagnostic dispatched; waiting for independent Rish identity and artifact proof. Not marked complete."
            )
        } catch (e: Exception) {
            jobLedger.transition(jobId, "RECEIVED", "FAILED", (e.message ?: "Termux dispatch failed").take(1900))
            activeClient.sendFailure(jobId, "TERMUX_DISPATCH_FAILED", e.message ?: "Termux dispatch failed", true)
        }
    }

    private fun updateConnectionState(state: String, detail: String) {
        currentDetail = detail.take(1000)
        getSharedPreferences("controller_state", MODE_PRIVATE).edit()
            .putString("connection_state", state)
            .putString("connection_detail", currentDetail)
            .putLong("connection_updated_at_ms", System.currentTimeMillis())
            .apply()
    }

    private fun updateNotification(detail: String) {
        try {
            getSystemService(NotificationManager::class.java)
                .notify(notificationId, buildNotification(detail))
        } catch (_: Exception) {
            // A notification update must not crash the command supervisor.
        }
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(
                NotificationChannel(channelId, getString(R.string.notification_channel_name), NotificationManager.IMPORTANCE_LOW)
            )
        }
    }

    private fun buildNotification(detail: String): Notification {
        val openIntent = Intent(this, MainActivity::class.java).setData(android.net.Uri.parse("omnikali://controller/status"))
        val pending = PendingIntent.getActivity(
            this,
            0,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle(getString(R.string.notification_title))
            .setContentText(detail.take(120))
            .setStyle(NotificationCompat.BigTextStyle().bigText(detail.take(500)))
            .setContentIntent(pending)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun stopConnection() {
        client?.close()
        client = null
        updateConnectionState("DISCONNECTED", "Connection stopped by local user")
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        // Android 15 limits dataSync foreground-service runtime. Stop cleanly instead of pretending to stay persistent.
        stopConnection()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf(startId)
    }

    override fun onDestroy() {
        stopConnection()
        commandExecutor?.shutdownNow()
        commandExecutor = null
        ledger?.close()
        ledger = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_START = "com.omnikali.controller.START"
        const val ACTION_STOP = "com.omnikali.controller.STOP"
        const val OP_RISH_PROBE = "android.rish.transport.probe"
        const val SCOPE_RISH_PROBE = "android.rish.probe"
        const val KEY_HOST = "grpc_host"
        const val KEY_PORT = "grpc_port"
        private const val MAX_COMMAND_HORIZON_MS = 10 * 60 * 1000L
    }
}
