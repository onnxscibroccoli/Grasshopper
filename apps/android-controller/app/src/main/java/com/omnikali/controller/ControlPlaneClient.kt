package com.omnikali.controller

import android.content.Context
import com.omnikali.protocol.v1.ClientMessage
import com.omnikali.protocol.v1.ControlPlaneGrpc
import com.omnikali.protocol.v1.Heartbeat
import com.omnikali.protocol.v1.Hello
import com.omnikali.protocol.v1.JobAccepted
import com.omnikali.protocol.v1.JobFailure
import com.omnikali.protocol.v1.ServerMessage
import io.grpc.ManagedChannel
import io.grpc.stub.StreamObserver
import io.grpc.okhttp.OkHttpChannelBuilder
import java.io.ByteArrayInputStream
import java.io.Closeable
import java.security.KeyStore
import java.security.SecureRandom
import java.util.UUID
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager
import javax.net.ssl.KeyManagerFactory

data class ControlPlaneTarget(val host: String, val port: Int) {
    init {
        require(host.isNotBlank() && host.length <= 253) { "A valid control-plane hostname is required" }
        require(!host.contains("://") && !host.contains("/") && !host.contains("@")) {
            "Enter a hostname or IP address, not a URL"
        }
        require(port in 1..65535) { "Port must be between 1 and 65535" }
    }
}

interface ControlPlaneEvents {
    fun onConnectionState(state: String, detail: String)
    fun onServerMessage(message: ServerMessage)
    fun onProtocolViolation(detail: String)
}

class ControlPlaneClient(
    private val context: Context,
    private val target: ControlPlaneTarget,
    private val deviceId: String,
    private val events: ControlPlaneEvents
) : Closeable {
    private val running = AtomicBoolean(false)
    private val sequence = AtomicLong(0)
    private val reconnectAttempt = AtomicLong(0)
    private val scheduler: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
    private val lock = Any()

    @Volatile private var channel: ManagedChannel? = null
    @Volatile private var requestStream: StreamObserver<ClientMessage>? = null

    fun start() {
        if (!running.compareAndSet(false, true)) return
        events.onConnectionState("CONNECTING", "Opening TLS connection with client certificate authentication")
        scheduleReconnect(0)
        scheduler.scheduleAtFixedRate({
            sendHeartbeat()
        }, 20, 20, TimeUnit.SECONDS)
    }

    fun sendAccepted(jobId: String, state: String) {
        val payload = JobAccepted.newBuilder()
            .setJobId(jobId)
            .setState(state)
            .build()
        send(ClientMessage.newBuilder().setAccepted(payload))
    }

    fun sendFailure(jobId: String, code: String, message: String, retryable: Boolean) {
        val payload = JobFailure.newBuilder()
            .setJobId(jobId)
            .setErrorCode(code.take(128))
            .setMessage(message.take(1000))
            .setRetryable(retryable)
            .build()
        send(ClientMessage.newBuilder().setFailure(payload))
    }

    private fun connectAttempt() {
        if (!running.get()) return
        var newChannel: ManagedChannel? = null
        try {
            newChannel = createMutualTlsChannel()
            synchronized(lock) {
                if (!running.get()) {
                    newChannel.shutdownNow()
                    return
                }
                channel = newChannel
                requestStream = null
            }

            val localChannel = newChannel
            val lastServerSequence = AtomicLong(0)
            val responses = object : StreamObserver<ServerMessage> {
                override fun onNext(value: ServerMessage) {
                    val incoming = value.sequence
                    if (incoming > 0) {
                        while (true) {
                            val previous = lastServerSequence.get()
                            if (incoming <= previous) {
                                events.onProtocolViolation("Non-monotonic server sequence $incoming after $previous")
                                handleStreamFailure(localChannel, IllegalStateException("server replay detected"))
                                return
                            }
                            if (lastServerSequence.compareAndSet(previous, incoming)) break
                        }
                    }
                    events.onServerMessage(value)
                }

                override fun onError(t: Throwable) {
                    handleStreamFailure(localChannel, t)
                }

                override fun onCompleted() {
                    handleStreamFailure(localChannel, IllegalStateException("server closed stream"))
                }
            }

            val stream = ControlPlaneGrpc.newStub(localChannel).connect(responses)
            synchronized(lock) {
                if (!running.get() || channel !== localChannel) {
                    stream.onCompleted()
                    localChannel.shutdownNow()
                    return
                }
                requestStream = stream
            }

            val hello = Hello.newBuilder()
                .setAppVersion("0.1.0")
                .setProtocolVersion("1")
                .addCapabilities("android.rish.transport.probe")
                .addCapabilities("android.status")
                .build()
            send(ClientMessage.newBuilder().setHello(hello))
            reconnectAttempt.set(0)
            events.onConnectionState("CONNECTING", "TLS stream requested; awaiting the authenticated server welcome")
        } catch (e: Exception) {
            newChannel?.shutdownNow()
            events.onConnectionState("DISCONNECTED", "Connection attempt failed: ${safeError(e)}")
            scheduleReconnect(nextBackoffMs())
        }
    }

    private fun createMutualTlsChannel(): ManagedChannel {
        val material = SecureCredentialStore.load(context)
        try {
            val identity = KeyStore.getInstance("PKCS12")
            identity.load(ByteArrayInputStream(material.pkcs12), material.password)

            val keyManagers = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
            keyManagers.init(identity, material.password)

            val trustManagers = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
            trustManagers.init(null as KeyStore?)
            val trustedRoots = trustManagers.trustManagers.filterIsInstance<X509TrustManager>()
            check(trustedRoots.size == 1) { "System trust manager is unavailable" }

            val sslContext = SSLContext.getInstance("TLS")
            sslContext.init(keyManagers.keyManagers, trustedRoots.toTypedArray(), SecureRandom())

            return OkHttpChannelBuilder.forAddress(target.host, target.port)
                .sslSocketFactory(sslContext.socketFactory)
                .keepAliveTime(30, TimeUnit.SECONDS)
                .build()
        } finally {
            material.close()
        }
    }

    private fun sendHeartbeat() {
        if (!running.get()) return
        val heartbeat = Heartbeat.newBuilder()
            .setTimestampUnixMs(System.currentTimeMillis())
            .setExecutionState("READY")
            .build()
        send(ClientMessage.newBuilder().setHeartbeat(heartbeat))
    }

    private fun send(builder: ClientMessage.Builder) {
        val stream = requestStream ?: return
        val message = builder
            .setDeviceId(deviceId)
            .setSessionId(sessionId)
            .setSequence(sequence.incrementAndGet())
            .build()
        try {
            synchronized(lock) {
                if (running.get() && stream === requestStream) stream.onNext(message)
            }
        } catch (e: Exception) {
            val current = channel
            if (current != null) handleStreamFailure(current, e)
        }
    }

    @Volatile private var sessionId: String = UUID.randomUUID().toString()

    private fun handleStreamFailure(failedChannel: ManagedChannel, error: Throwable) {
        var shouldRetry = false
        synchronized(lock) {
            if (channel === failedChannel) {
                channel = null
                requestStream = null
                shouldRetry = running.get()
            }
        }
        failedChannel.shutdownNow()
        if (shouldRetry) {
            events.onConnectionState("DISCONNECTED", safeError(error))
            scheduleReconnect(nextBackoffMs())
        }
    }

    private fun scheduleReconnect(delayMs: Long) {
        if (!running.get()) return
        try {
            scheduler.schedule({ connectAttempt() }, delayMs, TimeUnit.MILLISECONDS)
        } catch (_: java.util.concurrent.RejectedExecutionException) {
            // close() owns shutdown; no follow-up work is allowed after it.
        }
    }

    private fun nextBackoffMs(): Long {
        val attempt = reconnectAttempt.getAndIncrement().coerceAtMost(6)
        return (1000L shl attempt.toInt()).coerceAtMost(60_000L)
    }

    private fun safeError(error: Throwable): String {
        val value = error.message ?: error.javaClass.simpleName
        return value.replace(Regex("(?i)(token|password|secret|authorization)=\\S+"), "$1=[redacted]").take(500)
    }

    override fun close() {
        if (!running.compareAndSet(true, false)) return
        scheduler.shutdownNow()
        synchronized(lock) {
            requestStream = null
            channel?.shutdownNow()
            channel = null
        }
        events.onConnectionState("DISCONNECTED", "Connection stopped by the local controller")
    }

    companion object {
        fun newDeviceId(context: Context): String {
            val preferences = context.getSharedPreferences("controller_identity", Context.MODE_PRIVATE)
            val existing = preferences.getString("device_id", null)
            if (existing != null) return existing
            val created = UUID.randomUUID().toString()
            preferences.edit().putString("device_id", created).apply()
            return created
        }
    }
}
