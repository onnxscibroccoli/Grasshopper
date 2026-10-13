package org.broccoli.companion

import android.os.Bundle
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.concurrent.Executors

/**
 * Bootstrap-preview companion. Does not include cloud push or production TLS setup.
 * Authenticated noVNC access is intentionally unavailable until a trusted external HTTPS gateway exists.
 */
class GatewayActivity : FragmentActivity() {
    private val alias = "broccoli_gateway_bootstrap_p256"
    private val io = Executors.newSingleThreadExecutor()
    private val prefs by lazy { getSharedPreferences("gateway", MODE_PRIVATE) }
    private lateinit var address: EditText
    private lateinit var pairing: EditText
    private lateinit var ticket: EditText
    private lateinit var message: TextView

    private fun encode(bytes: ByteArray) =
        Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(26, 25, 26, 30)
        }
        fun field(hintText: String, value: String = "") = EditText(this).also {
            it.hint = hintText
            it.setText(value)
            it.textSize = 16f
            column.addView(it)
        }
        fun button(label: String, action: () -> Unit) {
            column.addView(Button(this).apply { text = label; setOnClickListener { action() } })
        }
        column.addView(TextView(this).apply {
            textSize = 20f
            text = "Broccoli Secure Gateway — bootstrap preview"
        })
        column.addView(TextView(this).apply {
            text = "Pairing and desktop access require a verified HTTPS gateway. No credentials or payment details are collected. Firebase push is not enabled in this bootstrap APK."
        })
        address = field("https://trusted-gateway.example", prefs.getString("origin", "") ?: "")
        pairing = field("Private one-time pairing code")
        ticket = field("Task UUID", intent.getStringExtra("ticket_id") ?: "")
        button("Pair this device", ::pairDevice)
        button("Check pending handoffs (biometric)", ::listHandoffs)
        button("Approve noVNC access (biometric)", ::approveViewer)
        message = TextView(this).apply {
            textSize = 16f
            text = "Ready for pairing when protected gateway is deployed."
        }
        column.addView(message)
        setContentView(ScrollView(this).apply { addView(column) })
    }

    private fun report(text: String) = runOnUiThread { message.text = text }

    private fun origin(text: String): String {
        val value = text.trim().trimEnd('/')
        val url = URL(value)
        require(url.protocol == "https" && url.host.isNotBlank() &&
            url.port == -1 && url.userInfo == null && url.query == null &&
            url.ref == null && (url.path.isEmpty() || url.path == "/")) {
            "A trusted HTTPS origin without tokens or paths is required"
        }
        return value
    }

    private fun signingEntry(): KeyStore.PrivateKeyEntry {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (!store.containsAlias(alias)) {
            val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
            generator.initialize(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(true)
                .setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
                .setInvalidatedByBiometricEnrollment(true)
                .build())
            generator.generateKeyPair()
        }
        return store.getEntry(alias, null) as KeyStore.PrivateKeyEntry
    }

    private fun post(origin: String, endpoint: String, payload: JSONObject): JSONObject {
        val connection = URL(origin + endpoint).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 10000
        connection.readTimeout = 10000
        connection.doOutput = true
        connection.setRequestProperty("Origin", origin)
        connection.setRequestProperty("Content-Type", "application/json")
        try {
            connection.outputStream.use {
                it.write(payload.toString().toByteArray(StandardCharsets.UTF_8))
            }
            require(connection.responseCode == 200) {
                "Gateway HTTP status " + connection.responseCode
            }
            return JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } finally {
            connection.disconnect()
        }
    }

    private fun pairDevice() {
        val selected = address.text.toString()
        val oneTime = pairing.text.toString().trim()
        if (oneTime.length < 12) { report("A valid one-time pairing code is required."); return }
        io.execute {
            try {
                val host = origin(selected)
                val key = signingEntry()
                val response = post(host, "/v1/device/enroll",
                    JSONObject().put("pairing_code", oneTime)
                        .put("public_key", encode(key.certificate.publicKey.encoded)))
                prefs.edit().putString("origin", host)
                    .putString("device_id", response.getString("device_id")).apply()
                report("Pairing completed. The device's signing key remains in Android Keystore.")
            } catch (e: Exception) {
                report("Pairing incomplete: " + e.javaClass.simpleName + ". Check trusted HTTPS and private pairing code.")
            }
        }
    }

    private fun requireBiometric(purpose: String, taskId: String,
                                 authorized: (String, JSONObject) -> Unit) {
        val selected = address.text.toString()
        io.execute {
            try {
                val host = origin(selected)
                require(host == prefs.getString("origin", "")) { "Gateway does not match pairing" }
                val device = prefs.getString("device_id", null) ?: error("Device not paired")
                val challenge = post(host, "/v1/device/challenge",
                    JSONObject().put("device_id", device)
                        .put("ticket_id", taskId).put("purpose", purpose))
                val signature = Signature.getInstance("SHA256withECDSA").apply {
                    initSign(signingEntry().privateKey)
                }
                runOnUiThread {
                    val callback = object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            val unlocked = result.cryptoObject?.signature
                            if (unlocked == null) {
                                report("Biometric signature unavailable.")
                                return
                            }
                            try {
                                unlocked.update(challenge.getString("payload").toByteArray(StandardCharsets.UTF_8))
                                val proof = JSONObject().put("device_id", device)
                                    .put("challenge_id", challenge.getString("challenge_id"))
                                    .put("signature", encode(unlocked.sign()))
                                    .put("purpose", purpose)
                                io.execute { authorized(host, proof) }
                            } catch (e: Exception) {
                                report("Signature failed: " + e.javaClass.simpleName)
                            }
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            report("Biometric approval cancelled or unavailable.")
                        }
                    }
                    val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this), callback)
                    val info = BiometricPrompt.PromptInfo.Builder()
                        .setTitle("Broccoli authorization")
                        .setSubtitle("Approve " + purpose + " for this task")
                        .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                        .setNegativeButtonText("Cancel")
                        .build()
                    prompt.authenticate(info, BiometricPrompt.CryptoObject(signature))
                }
            } catch (e: Exception) {
                report("Approval unavailable: " + e.javaClass.simpleName)
            }
        }
    }

    private fun listHandoffs() {
        requireBiometric("notifications", "-") { host, signed ->
            try {
                val response = post(host, "/v1/device/notifications", signed)
                val entries = response.getJSONArray("handoffs")
                report(entries.length().toString() + " pending action(s)")
                if (entries.length() == 1) {
                    runOnUiThread { ticket.setText(entries.getJSONObject(0).getString("ticket_id")) }
                }
            } catch (e: Exception) {
                report("Could not query tasks: " + e.javaClass.simpleName)
            }
        }
    }

    private fun approveViewer() {
        val taskId = ticket.text.toString().trim()
        if (!Regex("[a-zA-Z0-9-]{12,64}").matches(taskId)) {
            report("Enter a valid task ID."); return
        }
        requireBiometric("viewer", taskId) { host, signed ->
            try {
                val response = post(host, "/v1/device/approve", signed)
                val grant = response.getString("grant")
                val form = ("grant=" + URLEncoder.encode(grant, "UTF-8"))
                    .toByteArray(StandardCharsets.UTF_8)
                runOnUiThread { openViewer(host, form) }
            } catch (e: Exception) {
                report("Desktop approval rejected: " + e.javaClass.simpleName)
            }
        }
    }

    private fun openViewer(host: String, data: ByteArray) {
        val view = WebView(this)
        view.settings.javaScriptEnabled = true
        view.settings.domStorageEnabled = true
        view.settings.allowFileAccess = false
        view.settings.allowContentAccess = false
        view.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        CookieManager.getInstance().setAcceptThirdPartyCookies(view, false)
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return uri.scheme != "https" || uri.host != URL(host).host || uri.port != -1
            }
        }
        setContentView(view)
        view.postUrl(host + "/v1/viewer/redeem", data)
    }
}
