// ==UserScript==
// @name         UniFi Offline Highlighter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Highlights "Offline" status in red on UniFi UI page
// @author       Tyler Findleton
// @match        https://unifi.ui.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    /**
     * Function to style offline status
     */
    function highlightOffline() {
        // Select all span elements with data-label="Offline"
        const offlineElements = document.querySelectorAll('span[data-label="Offline"]');

        offlineElements.forEach(el => {
            // Check if the span contains the exact text "Offline"
            if (el.textContent.trim() === 'Offline') {
                el.style.color = 'red';
                //el.style.fontWeight = 'bold';
            }
        });
    }

    /**
     * Initial call to highlightOffline
     */
    highlightOffline();

    /**
     * Observe the DOM for any changes and re-apply the highlighting
     */
    const observer = new MutationObserver((mutations) => {
        let shouldRun = false;
        for(const mutation of mutations) {
            if (mutation.type === 'childList' || mutation.type === 'subtree') {
                shouldRun = true;
                break;
            }
        }
        if (shouldRun) {
            highlightOffline();
        }
    });

    // Start observing the body for changes
    observer.observe(document.body, { childList: true, subtree: true });

})();
