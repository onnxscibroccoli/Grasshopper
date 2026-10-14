package com.omnikali.controller

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager

object TermuxRunCommandBridge {
    const val ACTION_RUN = "com.termux.RUN_COMMAND"
    const val EXTRA_PATH = "com.termux.RUN_COMMAND_PATH"
    const val EXTRA_ARGUMENTS = "com.termux.RUN_COMMAND_ARGUMENTS"
    const val EXTRA_WORKDIR = "com.termux.RUN_COMMAND_WORKDIR"
    const val EXTRA_BACKGROUND = "com.termux.RUN_COMMAND_BACKGROUND"
    const val TERMUX_PACKAGE = "com.termux"
    private const val TERMUX_BASH = "/data/data/com.termux/files/usr/bin/bash"
    private const val RISH_REPOSITORY = "/data/data/com.termux/files/home/broccoli-rish"

    /**
     * Start only the canonical live proof. It deliberately does not accept a command parameter.
     * A successful startService call proves dispatch, not shell execution or target identity.
     */
    fun dispatchTransportProbe(context: Context) {
        val packageManager = context.packageManager
        try {
            packageManager.getPackageInfo(TERMUX_PACKAGE, PackageManager.PackageInfoFlags.of(0))
        } catch (e: Exception) {
            throw IllegalStateException("Termux is not installed", e)
        }

        val command = "cd '$RISH_REPOSITORY' && RISH_PRESERVE_ENV=0 bash ./lib/rish_transport_probe.sh"
        val intent = Intent(ACTION_RUN).apply {
            component = ComponentName(TERMUX_PACKAGE, "com.termux.app.RunCommandService")
            putExtra(EXTRA_PATH, TERMUX_BASH)
            putExtra(EXTRA_ARGUMENTS, arrayOf("-lc", command))
            putExtra(EXTRA_WORKDIR, RISH_REPOSITORY)
            putExtra(EXTRA_BACKGROUND, true)
        }

        try {
            context.startService(intent)
                ?: throw IllegalStateException("Termux declined the command service request")
        } catch (e: SecurityException) {
            throw IllegalStateException(
                "Termux external commands are not authorized. Enable allow-external-apps in Termux and verify Termux's own Shizuku authorization.",
                e
            )
        } catch (e: IllegalStateException) {
            throw e
        } catch (e: Exception) {
            throw IllegalStateException("Unable to start Termux command service", e)
        }
    }
}
