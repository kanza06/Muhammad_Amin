package com.kahfi.photobooth

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import android.content.Context
import android.text.InputType
import android.view.Gravity

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val prefs by lazy { getSharedPreferences("kahfi_native", Context.MODE_PRIVATE) }
    private var lastTriggerAt = 0L
    private var pendingPermissionRequest: PermissionRequest? = null
    private val cameraRequestCode = 741

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enterImmersiveMode()

        webView = WebView(this)
        webView.setBackgroundColor(Color.rgb(237, 247, 255))
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.allowFileAccess = false
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        webView.addJavascriptInterface(NativeBridge(), "KahfiNative")
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                view?.evaluateJavascript("window.__KAHFI_NATIVE_BRIDGE__ = true;", null)
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val hasCamera = checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                    if (hasCamera) {
                        val allowed = request.resources.filter {
                            it == PermissionRequest.RESOURCE_VIDEO_CAPTURE || it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                        }.toTypedArray()
                        if (allowed.isNotEmpty()) request.grant(allowed) else request.deny()
                    } else {
                        pendingPermissionRequest = request
                        requestPermissions(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO), cameraRequestCode)
                    }
                }
            }
        }
        setContentView(webView)

        val savedUrl = prefs.getString("site_url", null)
        if (savedUrl.isNullOrBlank()) showUrlDialog(null) else loadSite(savedUrl)
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO), cameraRequestCode)
        }
    }

    private fun loadSite(raw: String) {
        var url = raw.trim()
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = "http://$url"
        prefs.edit().putString("site_url", url).apply()
        webView.loadUrl(url)
    }

    private fun showUrlDialog(initial: String?) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 12, 48, 0)
        }
        val help = TextView(this).apply {
            text = "Masukkan alamat website KAHFI. Jika Next.js berjalan di komputer, gunakan IP LAN komputer, misalnya http://192.168.1.10:3000 (bukan localhost)."
            textSize = 14f
        }
        val input = EditText(this).apply {
            hint = "http://192.168.1.10:3000"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            setSingleLine(true)
            setText(initial ?: prefs.getString("site_url", ""))
        }
        box.addView(help)
        box.addView(input)
        AlertDialog.Builder(this)
            .setTitle("Hubungkan KAHFI PHOTOBOOTH")
            .setView(box)
            .setCancelable(false)
            .setPositiveButton("Simpan & Buka") { _, _ ->
                val value = input.text?.toString()?.trim().orEmpty()
                if (value.isBlank()) {
                    Toast.makeText(this, "Alamat website wajib diisi", Toast.LENGTH_LONG).show()
                    showUrlDialog(initial)
                } else loadSite(value)
            }
            .setNeutralButton("Muat ulang alamat tersimpan", null)
            .show()
    }

    private fun sendShutter(key: String) {
        val now = System.currentTimeMillis()
        if (now - lastTriggerAt < 450) return
        lastTriggerAt = now
        val safeKey = if (key == "VOLUME_UP") "VOLUME_UP" else "VOLUME_DOWN"
        runOnUiThread {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('kahfi-native-shutter',{detail:{key:'$safeKey'}}));",
                null
            )
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_VOLUME_UP -> {
                    sendShutter("VOLUME_UP")
                    return true // consume system volume and use it as shutter while this app is open
                }
                KeyEvent.KEYCODE_VOLUME_DOWN -> {
                    sendShutter("VOLUME_DOWN")
                    return true
                }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private inner class NativeBridge {
        @android.webkit.JavascriptInterface
        fun isAvailable(): Boolean = true

        @android.webkit.JavascriptInterface
        fun setSiteUrl(url: String) {
            runOnUiThread { loadSite(url) }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == cameraRequestCode) {
            val request = pendingPermissionRequest
            if (request != null) {
                val hasCamera = checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                if (hasCamera) {
                    val allowed = request.resources.filter {
                        it == PermissionRequest.RESOURCE_VIDEO_CAPTURE || it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                    }.toTypedArray()
                    if (allowed.isNotEmpty()) request.grant(allowed) else request.deny()
                } else request.deny()
                pendingPermissionRequest = null
            }
        }
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        AlertDialog.Builder(this)
            .setTitle("KAHFI PHOTOBOOTH")
            .setItems(arrayOf("Kembali ke halaman sebelumnya", "Ubah alamat website", "Keluar")) { _, which ->
                when (which) {
                    0 -> if (webView.canGoBack()) webView.goBack() else Toast.makeText(this, "Tidak ada halaman sebelumnya", Toast.LENGTH_SHORT).show()
                    1 -> showUrlDialog(prefs.getString("site_url", ""))
                    2 -> finish()
                }
            }
            .show()
    }

    private fun enterImmersiveMode() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersiveMode()
    }
}
