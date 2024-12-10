// ==UserScript==
// @name         UniFi Offline Highlighter
// @namespace    http://tampermonkey.net/
// @version      1.0.3
// @description  Highlights devices with "Backup Created" indicator subtly on UniFi UI page
// @match        https://unifi.ui.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/unifi/ui-dashboard-offline-device.js
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/unifi/ui-dashboard-offline-device.js
// ==/UserScript==

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        selectors: {
            gridItem: '.virtuoso-grid-item',
            deviceLink: 'a[data-testid="oslink"]',
            backupSpan: '.tile-footer span.content__VCR3r9bC',
            offlineSpan: '.tile-footer.offline'
        },
        classes: {
            offlineDevice: 'offline-device'
        },
        styles: {
            normal: {
                color: '#8B0000',
                borderColor: 'rgba(255, 0, 0, 0.5)'
            },
            hover: {
                color: '#800000'
            }
        },
        debounceDelay: 250 // ms
    };

    /**
     * Debounce function to limit the rate of execution
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Inject custom CSS for offline devices
     */
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Offline device styling */
            ${CONFIG.selectors.deviceLink}.${CONFIG.classes.offlineDevice} {
                color: ${CONFIG.styles.normal.color} !important;
                border: 2px solid ${CONFIG.styles.normal.borderColor};
                border-radius: 6px;
                padding: 4px;
                text-decoration: none !important;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
                transition: all 0.2s ease;
            }

            ${CONFIG.selectors.deviceLink}.${CONFIG.classes.offlineDevice}:hover {
                color: ${CONFIG.styles.hover.color} !important;
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Function to highlight offline devices based on "Backup Created" text or "Offline" status
     */
    function highlightOfflineDevices() {
        try {
            const gridItems = document.querySelectorAll(CONFIG.selectors.gridItem);

            gridItems.forEach((item) => {
                const mainLink = item.querySelector(CONFIG.selectors.deviceLink);
                const backupSpan = item.querySelector(CONFIG.selectors.backupSpan);
                const offlineSpan = item.querySelector(CONFIG.selectors.offlineSpan);

                if (!mainLink) return;

                const hasBackup = backupSpan?.textContent.includes('Backup Created') || false;
                const isOffline = offlineSpan?.textContent.includes('Offline') || false;
                mainLink.classList.toggle(CONFIG.classes.offlineDevice, hasBackup || isOffline);
            });
        } catch (error) {
            console.error('Error in UniFi Offline Highlighter:', error);
        }
    }

    /**
     * Initialize the script
     */
    function init() {
        try {
            injectStyles();
            highlightOfflineDevices();

            // Create debounced version of highlightOfflineDevices
            const debouncedHighlight = debounce(highlightOfflineDevices, CONFIG.debounceDelay);

            // Set up the observer
            const observer = new MutationObserver((mutations) => {
                if (mutations.some(m => m.type === 'childList' || m.type === 'subtree')) {
                    debouncedHighlight();
                }
            });

            // Start observing
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (error) {
            console.error('Error initializing UniFi Offline Highlighter:', error);
        }
    }

    // Start the script
    init();
})();