package com.remotedisplay.player

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class RemoteDisplayApp : Application() {

    companion object {
        const val CHANNEL_ID = "camanchaca_player_service"
        const val CHANNEL_NAME = "Servicio de Camanchaca Player"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Servicio en segundo plano de Camanchaca Player"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
