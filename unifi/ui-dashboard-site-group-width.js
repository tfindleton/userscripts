// ==UserScript==
// @name         UniFi Dashboard Site Group Width
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adjusts the width of the UniFi dashboard when editing Site Group devices
// @match        https://unifi.ui.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/unifi/ui-dashboard-site-group-width.js
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/unifi/ui-dashboard-site-group-width.js
// ==/UserScript==

(function () {
    'use strict';

    /**
     * Inject custom CSS for modal width
     */
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Set width for modal medium */
            .modal-medium__Ji1BDxnM {
                width: 1000px !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Initialize the script
     */
    function init() {
        try {
            injectStyles();
        } catch (error) {
            console.error('Error initializing UniFi Dashboard Width:', error);
        }
    }

    // Start the script
    init();
})();