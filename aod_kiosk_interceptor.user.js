// ==UserScript==
// @name         Attendance on Demand Kiosk to Shoreline-Rebuild Interceptor
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Intercepts punches from the Attendance on Demand kiosk and logs them to Shoreline-Rebuild backend in real-time.
// @author       You
// @match        https://*.attendanceondemand.com/kiosk/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // Shoreline API configuration — set at deploy time; never commit real secrets
    const SHORELINE_API_URL = "http://localhost:3001/api";
    // Must match server KIOSK_API_SECRET (≥16 chars). Leave placeholder empty until configured.
    const KIOSK_API_SECRET = "";

    if (!KIOSK_API_SECRET || KIOSK_API_SECRET.length < 16) {
        console.warn("[Shoreline Interceptor] KIOSK_API_SECRET not configured — punches will not be forwarded.");
        return;
    }
    function initializeHook() {
        if (typeof window.submitEntry === 'function' && !window.submitEntry.__isHooked) {
            const originalSubmitEntry = window.submitEntry;

            window.submitEntry = function(badgeId) {
                const operationCode = window.activeOperation !== undefined ? String(window.activeOperation) : "Unknown";
                const operationMap = {
                    "1": "In",
                    "2": "Out"
                };
                const operationName = operationMap[operationCode] || `Operation #${operationCode}`;

                const punchData = {
                    badge_id: badgeId,
                    operation: operationName,
                    kiosk_id: window.kioskIdentifier || 'Default',
                    punched_at: new Date().toISOString()
                };

                console.log("[Shoreline Interceptor] Captured punch:", punchData);

                // Send the punch to the Shoreline Node/Express backend
                fetch(`${SHORELINE_API_URL}/timecard/webhook`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${KIOSK_API_SECRET}`
                    },
                    body: JSON.stringify(punchData)
                })
                .then(response => {
                    if (response.ok) {
                        console.log("[Shoreline Interceptor] Successfully logged punch to Shoreline Backend");
                    } else {
                        console.error("[Shoreline Interceptor] Failed to log punch:", response.statusText);
                    }
                })
                .catch(error => {
                    console.error("[Shoreline Interceptor] Error posting to Shoreline Backend:", error);
                });

                // Call the original Attendance on Demand submission function so the official clock-in works
                return originalSubmitEntry.apply(this, arguments);
            };

            window.submitEntry.__isHooked = true;
            console.log("[Shoreline Interceptor] Hook successfully attached to submitEntry!");
        }
    }

    // Attempt to hook, and run periodically to ensure it captures dynamically loaded scripts
    initializeHook();
    const interval = setInterval(() => {
        initializeHook();
        if (window.submitEntry && window.submitEntry.__isHooked) {
            clearInterval(interval);
        }
    }, 1000);
})();
