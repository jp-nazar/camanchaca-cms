package com.remotedisplay.player.data

import android.content.Context
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

class ContentCache(private val context: Context) {

    private val cacheDir = File(context.filesDir, "content_cache").also { it.mkdirs() }
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.MINUTES)
        .build()

    fun getCachedFile(contentId: String): File? {
        val files = cacheDir.listFiles { _, name -> name.startsWith(contentId) }
        // Return newest file (favors versioned filenames over unversioned)
        return files?.sortedByDescending { it.name }?.firstOrNull()?.takeIf { it.exists() && it.length() > 0 }
    }

    fun isContentCached(contentId: String): Boolean {
        return getCachedFile(contentId) != null
    }

    fun isContentCached(contentId: String, contentVersion: Long): Boolean {
        if (contentVersion == 0L) return isContentCached(contentId)
        return cacheDir.listFiles { _, name ->
            name.startsWith("${contentId}_v${contentVersion}.")
        }?.any { it.exists() && it.length() > 0 } == true
    }

    fun downloadContent(serverUrl: String, contentId: String, filename: String, contentVersion: Long = 0): File? {
        try {
            val versionParam = if (contentVersion > 0) "?v=${contentVersion}" else ""
            val url = "${serverUrl}/api/content/${contentId}/file${versionParam}"
            val request = Request.Builder().url(url).build()
            val response = client.newCall(request).execute()

            if (!response.isSuccessful) {
                Log.e("ContentCache", "Download failed: ${response.code}")
                return null
            }

            val ext = filename.substringAfterLast('.', "mp4")
            val versionSuffix = if (contentVersion > 0) "_v${contentVersion}" else ""
            val file = File(cacheDir, "${contentId}${versionSuffix}.${ext}")

            // Remove stale cached versions for this content
            cacheDir.listFiles { _, name ->
                name.startsWith("${contentId}_v") && name != file.name
            }?.forEach { it.delete() }
            // Remove old unversioned file
            File(cacheDir, "${contentId}.${ext}").delete()

            response.body?.byteStream()?.use { input ->
                FileOutputStream(file).use { output ->
                    input.copyTo(output)
                }
            }

            Log.i("ContentCache", "Downloaded: $filename -> ${file.absolutePath}")
            return file
        } catch (e: Exception) {
            Log.e("ContentCache", "Download error: ${e.message}")
            return null
        }
    }

    fun deleteContent(contentId: String) {
        cacheDir.listFiles { _, name -> name.startsWith(contentId) }?.forEach { it.delete() }
        Log.i("ContentCache", "Deleted cached content: $contentId")
    }

    fun clearAll() {
        cacheDir.listFiles()?.forEach { it.delete() }
    }

    fun getCacheSize(): Long {
        return cacheDir.listFiles()?.sumOf { it.length() } ?: 0L
    }
}
