package com.omnikali.controller

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.nio.ByteBuffer
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.KeyStore
import java.security.SecureRandom
import java.util.Arrays
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object SecureCredentialStore {
    private const val ALIAS = "com.omnikali.controller.mtls.aes.v1"
    private const val FILE_NAME = "mtls-identity.enc"
    private const val IV_LENGTH = 12
    private const val TAG_BITS = 128
    private const val MAX_PKCS12_BYTES = 2 * 1024 * 1024

    data class Material(val pkcs12: ByteArray, val password: CharArray) : AutoCloseable {
        override fun close() {
            Arrays.fill(pkcs12, 0)
            Arrays.fill(password, '\u0000')
        }
    }

    fun exists(context: Context): Boolean = File(context.noBackupFilesDir, FILE_NAME).isFile

    @Synchronized
    fun save(context: Context, pkcs12: ByteArray, password: CharArray) {
        require(pkcs12.isNotEmpty() && pkcs12.size <= MAX_PKCS12_BYTES) { "PKCS#12 file size is invalid" }
        require(password.isNotEmpty()) { "PKCS#12 password is required" }
        validatePkcs12(pkcs12, password)

        val payloadBytes = ByteArrayOutputStream().use { bytes ->
            DataOutputStream(bytes).use { out ->
                out.writeInt(pkcs12.size)
                out.write(pkcs12)
                out.writeUTF(String(password))
            }
            bytes.toByteArray()
        }

        try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
            val encrypted = cipher.doFinal(payloadBytes)
            val envelope = ByteBuffer.allocate(1 + cipher.iv.size + encrypted.size)
                .put(1.toByte())
                .put(cipher.iv)
                .put(encrypted)
                .array()

            val target = File(context.noBackupFilesDir, FILE_NAME)
            val temporary = File(context.noBackupFilesDir, "$FILE_NAME.new")
            temporary.writeBytes(envelope)
            try {
                Files.move(
                    temporary.toPath(),
                    target.toPath(),
                    StandardCopyOption.REPLACE_EXISTING,
                    StandardCopyOption.ATOMIC_MOVE
                )
            } catch (_: Exception) {
                Files.move(temporary.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
            } finally {
                if (temporary.exists()) temporary.delete()
            }
            Arrays.fill(envelope, 0)
            Arrays.fill(encrypted, 0)
        } finally {
            Arrays.fill(payloadBytes, 0)
        }
    }

    @Synchronized
    fun load(context: Context): Material {
        val file = File(context.noBackupFilesDir, FILE_NAME)
        check(file.isFile) { "A gateway-issued PKCS#12 client identity must be imported first" }
        val envelope = file.readBytes()
        try {
            require(envelope.size > 1 + IV_LENGTH && envelope.size <= MAX_PKCS12_BYTES + 8192) {
                "Encrypted credential envelope has an invalid size"
            }
            require(envelope[0].toInt() == 1) { "Unsupported encrypted credential format" }
            val iv = envelope.copyOfRange(1, 1 + IV_LENGTH)
            val ciphertext = envelope.copyOfRange(1 + IV_LENGTH, envelope.size)
            try {
                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), GCMParameterSpec(TAG_BITS, iv))
                val plain = cipher.doFinal(ciphertext)
                try {
                    DataInputStream(ByteArrayInputStream(plain)).use { input ->
                        val length = input.readInt()
                        require(length in 1..MAX_PKCS12_BYTES && length <= input.available()) {
                            "Decrypted PKCS#12 payload has an invalid size"
                        }
                        val p12 = ByteArray(length)
                        input.readFully(p12)
                        val pass = input.readUTF().toCharArray()
                        require(input.available() == 0) { "Unexpected data in credential payload" }
                        try {
                            validatePkcs12(p12, pass)
                        } catch (e: Exception) {
                            Arrays.fill(p12, 0)
                            Arrays.fill(pass, '\u0000')
                            throw e
                        }
                        return Material(p12, pass)
                    }
                } finally {
                    Arrays.fill(plain, 0)
                }
            } finally {
                Arrays.fill(ciphertext, 0)
                Arrays.fill(iv, 0)
            }
        } finally {
            Arrays.fill(envelope, 0)
        }
    }

    private fun validatePkcs12(bytes: ByteArray, password: CharArray) {
        val store = KeyStore.getInstance("PKCS12")
        store.load(ByteArrayInputStream(bytes), password)
        val aliases = store.aliases()
        var validKeyEntry = false
        while (aliases.hasMoreElements()) {
            val alias = aliases.nextElement()
            if (!store.isKeyEntry(alias)) continue
            val certificate = store.getCertificate(alias) ?: continue
            certificate.checkValidity()
            validKeyEntry = true
        }
        require(validKeyEntry) { "PKCS#12 must contain a valid client private-key entry" }
    }

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        val existing = keyStore.getKey(ALIAS, null)
        if (existing is SecretKey) return existing

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }
}
