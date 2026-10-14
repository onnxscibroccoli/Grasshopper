package com.omnikali.controller

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != Intent.ACTION_BOOT_COMPLETED) return
        val manager = context.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    context.getString(R.string.notification_channel_name),
                    NotificationManager.IMPORTANCE_DEFAULT
                )
            )
        }

        val openController = Intent(context, MainActivity::class.java)
            .setData(android.net.Uri.parse("omnikali://controller/status"))
        val pending = PendingIntent.getActivity(
            context,
            7701,
            openController,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle(context.getString(R.string.notification_boot_title))
            .setContentText(context.getString(R.string.notification_boot_body))
            .setStyle(NotificationCompat.BigTextStyle().bigText(context.getString(R.string.notification_boot_body)))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .build()
        try {
            manager.notify(NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
            // Notification permission may be denied; the app still requires manual post-boot verification.
        }
    }

    companion object {
        private const val CHANNEL_ID = "omnikali-controller"
        private const val NOTIFICATION_ID = 18421
    }
}
