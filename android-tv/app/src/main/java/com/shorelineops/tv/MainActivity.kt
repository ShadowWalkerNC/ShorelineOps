package com.shorelineops.tv

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Fullscreen kiosk activity hosting the /tv wall-display web UI in a WebView.
 * First run (no saved server URL) redirects to [SetupActivity].
 */
class MainActivity : Activity() {

    private var webView: WebView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val baseUrl = prefs().getString(KEY_SERVER_URL, "").orEmpty().trim().trimEnd('/')
        if (baseUrl.isEmpty()) {
            startActivity(Intent(this, SetupActivity::class.java))
            finish()
            return
        }

        window.addFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )
        setContentView(R.layout.activity_main)

        val web = findViewById<WebView>(R.id.webview)
        webView = web
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        // Honor the page's viewport meta so the 10-foot layout fits 1080p
        // instead of rendering zoomed into a narrow default viewport.
        web.settings.useWideViewPort = true
        web.settings.loadWithOverviewMode = true
        web.webViewClient = WebViewClient()
        web.loadUrl(baseUrl + TV_PATH)
    }

    /** D-pad Back navigates WebView history; exits only at the first page. */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        val web = webView
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onDestroy() {
        webView?.destroy()
        webView = null
        super.onDestroy()
    }

    private fun prefs() = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    companion object {
        const val PREFS_NAME = "shoreline_tv"
        const val KEY_SERVER_URL = "server_url"

        /** Default wall-display route served by the Express API (see server/src/routes/tv.ts). */
        const val TV_PATH = "/tv/menu"
    }
}
