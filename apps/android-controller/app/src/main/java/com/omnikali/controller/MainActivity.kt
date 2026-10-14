package com.omnikali.controller

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import rikka.shizuku.Shizuku
import java.io.ByteArrayOutputStream
import java.util.Arrays

class MainActivity : Activity() {
    private lateinit var statusText: TextView
    private lateinit var hostInput: EditText
    private lateinit var portInput: EditText
    private lateinit var certificatePasswordInput: EditText
    private lateinit var shizukuText: TextView
    private var selectedPkcs12: ByteArray? = null

    private val permissionRequestCode = 27014
    private val binderReceivedListener = Shizuku.OnBinderReceivedListener { runOnUiThread { refreshStatus() } }
    private val binderDeadListener = Shizuku.OnBinderDeadListener { runOnUiThread { refreshStatus() } }
    private val permissionResultListener = Shizuku.OnRequestPermissionResultListener { requestCode, _ ->
        if (requestCode == permissionRequestCode) runOnUiThread { refreshStatus() }
    }

    private val certificatePicker = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            try {
                selectedPkcs12 = readBounded(uri)
                statusText.text = "Certificate file selected. Enter its password and tap Import mTLS identity."
            } catch (e: Exception) {
                selectedPkcs12 = null
                statusText.text = "Certificate import failed: " + safeError(e)
            }
        }
    }

    private val notificationPermissionRequest = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        statusText.text = if (granted) "Notifications enabled." else "Notifications are disabled; foreground-service visibility may be limited."
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        Shizuku.addBinderReceivedListener(binderReceivedListener)
        Shizuku.addBinderDeadListener(binderDeadListener)
        Shizuku.addRequestPermissionResultListener(permissionResultListener)
        requestNotificationPermissionIfNeeded()
        restoreEndpoint()
        handleDeepLink(intent)
        refreshStatus()
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    override fun onDestroy() {
        Shizuku.removeBinderReceivedListener(binderReceivedListener)
        Shizuku.removeBinderDeadListener(binderDeadListener)
        Shizuku.removeRequestPermissionResultListener(permissionResultListener)
        selectedPkcs12?.let { Arrays.fill(it, 0) }
        selectedPkcs12 = null
        super.onDestroy()
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(24))
        }
        val scroller = ScrollView(this)
        val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        scroller.addView(content)

        content.addView(TextView(this).apply {
            text = "OmniKali Controller"
            textSize = 25f
            setTextColor(0xff18213a.toInt())
        }, matchWrap())
        content.addView(TextView(this).apply {
            text = "Android execution edge · non-root · fail-closed"
            textSize = 14f
        }, marginParams(bottom = 16))

        shizukuText = TextView(this).apply { textSize = 16f }
        content.addView(shizukuText, marginParams(bottom = 8))

        content.addView(button("Refresh status") { refreshStatus() })
        content.addView(button("Request controller Shizuku permission") { requestShizukuPermission() })
        content.addView(button("Run local Rish transport proof") { launchLocalProbe() })
        content.addView(button("Import mTLS client identity (.p12/.pfx)") {
            certificatePicker.launch(arrayOf("*/*"))
        })

        hostInput = EditText(this).apply {
            hint = "Control-plane hostname (DNS or IP)"
            singleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
        }
        portInput = EditText(this).apply {
            hint = "gRPC TLS port"
            setText("443")
            singleLine = true
            inputType = InputType.TYPE_CLASS_NUMBER
        }
        certificatePasswordInput = EditText(this).apply {
            hint = "PKCS#12 password (not saved as plaintext)"
            singleLine = true
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        content.addView(hostInput, marginParams(top = 16))
        content.addView(portInput, marginParams(top = 4))
        content.addView(certificatePasswordInput, marginParams(top = 4))
        content.addView(button("Import selected mTLS identity") { importCredential() })
        content.addView(button("Save endpoint and connect securely") { connect() })
        content.addView(button("Disconnect") { disconnect() })

        statusText = TextView(this).apply {
            textSize = 14f
            setTextColor(0xff343b4f.toInt())
            setPadding(0, dp(14), 0, dp(8))
            text = "Waiting for status"
        }
        content.addView(statusText, marginParams(top = 8))

        content.addView(TextView(this).apply {
            textSize = 12f
            text = "Security boundary: only android.rish.transport.probe is remotely dispatchable. The app does not accept shell strings. A command is not marked complete until target identity and artifact evidence are independently verified. The connection needs a gateway-issued client certificate."
        }, marginParams(top = 12))

        root.addView(scroller, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ))
        setContentView(root)
    }

    private fun refreshStatus() {
        val state = try {
            when {
                !Shizuku.pingBinder() -> "SHIZUKU_UNAVAILABLE"
                Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED -> "SHIZUKU_PERMISSION_REQUIRED"
                else -> "SHIZUKU_READY"
            }
        } catch (_: Exception) {
            "SHIZUKU_UNAVAILABLE"
        }
        shizukuText.text = "Controller Shizuku state: " + state +
            "\nTermux Rish authorization is a separate package-level permission and is not inferred from this state."

        val statePrefs = getSharedPreferences("controller_state", MODE_PRIVATE)
        val networkState = statePrefs.getString("connection_state", "DISCONNECTED")
        val detail = statePrefs.getString("connection_detail", "No connection attempt recorded")
        val whenMs = statePrefs.getLong("connection_updated_at_ms", 0L)
        val identity = if (SecureCredentialStore.exists(this)) "mTLS identity: imported and encrypted at rest" else "mTLS identity: not imported"
        val endpoint = if (hostInput.text.isNotBlank()) hostInput.text.toString() + ":" + portInput.text.toString() else "not configured"
        val time = if (whenMs == 0L) "never" else java.text.DateFormat.getDateTimeInstance().format(java.util.Date(whenMs))
        statusText.text = "Control stream: " + networkState + "\n" + detail +
            "\n" + identity + "\nEndpoint: " + endpoint + "\nLast state update: " + time
    }

    private fun requestShizukuPermission() {
        try {
            if (!Shizuku.pingBinder()) {
                statusText.text = "Shizuku service unavailable. Open Shizuku and start it manually, then return here."
                val launch = packageManager.getLaunchIntentForPackage("moe.shizuku.privileged.api")
                if (launch != null) startActivity(launch)
                return
            }
            if (Shizuku.isPreV11()) {
                statusText.text = "This Shizuku API level is unsupported. Update Shizuku before continuing."
                return
            }
            if (Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED) {
                statusText.text = "Controller Shizuku permission is already granted. Verify Termux's permission separately."
                refreshStatus()
                return
            }
            Shizuku.requestPermission(permissionRequestCode)
        } catch (e: Exception) {
            statusText.text = "Shizuku permission request failed: " + safeError(e)
        }
    }

    private fun launchLocalProbe() {
        try {
            TermuxRunCommandBridge.dispatchTransportProbe(this)
            getSharedPreferences("controller_state", MODE_PRIVATE).edit()
                .putString("connection_state", "RISH_INITIALIZATION_REQUIRED")
                .putString("connection_detail", "Termux accepted the fixed diagnostic launch; inspect its proof artifact before claiming PASS.")
                .putLong("connection_updated_at_ms", System.currentTimeMillis())
                .apply()
            statusText.text = "Probe launch requested in Termux. This app cannot equate service dispatch with Rish success. Confirm marker, uid=2000(shell), SDK, and the non-empty proof artifact."
        } catch (e: Exception) {
            statusText.text = "Probe dispatch failed: " + safeError(e)
        }
        refreshStatus()
    }

    private fun importCredential() {
        val bytes = selectedPkcs12 ?: run {
            statusText.text = "Select the gateway-issued PKCS#12 identity first."
            return
        }
        val password = certificatePasswordInput.text.toString().toCharArray()
        try {
            SecureCredentialStore.save(this, bytes, password)
            statusText.text = "mTLS identity imported and encrypted in app-private no-backup storage."
            selectedPkcs12?.let { Arrays.fill(it, 0) }
            selectedPkcs12 = null
            certificatePasswordInput.text.clear()
        } catch (e: Exception) {
            statusText.text = "mTLS identity rejected: " + safeError(e)
        } finally {
            Arrays.fill(password, '\u0000')
        }
    }

    private fun connect() {
        val host = hostInput.text.toString().trim()
        val port = portInput.text.toString().trim().toIntOrNull()
        if (port == null) {
            statusText.text = "Enter a numeric gRPC port."
            return
        }
        try {
            ControlPlaneTarget(host, port)
            getSharedPreferences("controller_endpoint", MODE_PRIVATE).edit()
                .putString(SheveryForegroundService.KEY_HOST, host)
                .putInt(SheveryForegroundService.KEY_PORT, port)
                .apply()
            if (!SecureCredentialStore.exists(this)) {
                statusText.text = "Import an authorized PKCS#12 client certificate before connecting."
                return
            }
            ContextCompat.startForegroundService(
                this,
                Intent(this, SheveryForegroundService::class.java).setAction(SheveryForegroundService.ACTION_START)
            )
            statusText.text = "Secure stream startup requested. Confirm CONNECTED after certificate and server checks complete."
        } catch (e: Exception) {
            statusText.text = "Connection configuration rejected: " + safeError(e)
        }
        refreshStatus()
    }

    private fun disconnect() {
        stopService(Intent(this, SheveryForegroundService::class.java).setAction(SheveryForegroundService.ACTION_STOP))
        refreshStatus()
    }

    private fun handleDeepLink(incoming: Intent?) {
        val uri: Uri = incoming?.data ?: return
        if (uri.scheme != "omnikali" || uri.host != "controller") return
        when (uri.lastPathSegment) {
            "probe" -> launchLocalProbe()
            "status" -> refreshStatus()
        }
    }

    private fun restoreEndpoint() {
        val preferences = getSharedPreferences("controller_endpoint", MODE_PRIVATE)
        hostInput.setText(preferences.getString(SheveryForegroundService.KEY_HOST, ""))
        portInput.setText(preferences.getInt(SheveryForegroundService.KEY_PORT, 443).toString())
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionRequest.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private fun readBounded(uri: Uri): ByteArray {
        val out = ByteArrayOutputStream()
        contentResolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Unable to open selected certificate" }
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                require(total <= 2 * 1024 * 1024) { "Certificate file exceeds 2 MiB" }
                out.write(buffer, 0, count)
            }
        }
        return out.toByteArray()
    }

    private fun safeError(error: Throwable): String =
        (error.message ?: error.javaClass.simpleName)
            .replace(Regex("(?i)(password|secret|token|authorization)=\\S+"), "$1=[redacted]")
            .take(500)

    private fun button(label: String, action: () -> Unit): Button =
        Button(this).apply {
            text = label
            setOnClickListener { action() }
        }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun matchWrap() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
    )

    private fun marginParams(top: Int = 0, bottom: Int = 0) =
        LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply {
            if (top != 0) topMargin = dp(top)
            if (bottom != 0) bottomMargin = dp(bottom)
        }
}
