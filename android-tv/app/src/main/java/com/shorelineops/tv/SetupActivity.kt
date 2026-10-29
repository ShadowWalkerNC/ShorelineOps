package com.shorelineops.tv

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText

/**
 * First-run screen: enter and save the facility server URL.
 * Fully D-pad navigable (see activity_setup.xml focus chain).
 */
class SetupActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup)

        val prefs = getSharedPreferences(MainActivity.PREFS_NAME, Context.MODE_PRIVATE)
        val input = findViewById<EditText>(R.id.server_url)
        val save = findViewById<Button>(R.id.save_button)

        input.setText(prefs.getString(MainActivity.KEY_SERVER_URL, "").orEmpty())

        save.setOnClickListener {
            val raw = input.text?.toString().orEmpty().trim().trimEnd('/')
            if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
                input.error = getString(R.string.setup_error_scheme)
                return@setOnClickListener
            }
            prefs.edit().putString(MainActivity.KEY_SERVER_URL, raw).apply()
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }
}
