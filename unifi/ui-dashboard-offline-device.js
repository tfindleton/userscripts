// ==UserScript==
// @name         UniFi Offline Highlighter
// @namespace    http://tampermonkey.net/
// @version      1.0.6
// @description  Highlights offline devices on UniFi UI page
// @match        https://unifi.ui.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/refs/heads/main/unifi/ui-dashboard-offline-device.js
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/refs/heads/main/unifi/ui-dashboard-offline-device.js
// ==/UserScript==

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        styleId: 'unifi-offline-device-style',
        selectors: {
            gridList: '.virtuoso-grid-list',
            gridItem: '.virtuoso-grid-item',
            deviceLink: 'a[data-testid="oslink"]',
            tileFooter: '.tile-footer',
            offlineSpan: '.tile-footer.offline',
            offlineAria: '[aria-label*="offline" i],[title*="offline" i]'
        },
        classes: {
            offlineDevice: 'offline-device'
        },
        styles: {
            normal: {
                color: '#8B0000',
                borderColor: 'rgba(255, 0, 0, 0.55)',
                backgroundColor: 'rgba(255, 0, 0, 0.04)'
            },
            hover: {
                color: '#800000',
                borderColor: 'rgba(255, 0, 0, 0.75)'
            }
        },
        rootDiscovery: {
            minDelayMs: 250,
            maxDelayMs: 8000
        }
    };

    const NEEDLES = {
        backupCreated: 'backup created',
        offline: 'offline'
    };

    const state = {
        observer: null,
        observedRoot: null,
        pendingGridItems: new Set(),
        flushScheduled: false,
        rootDiscoveryTimer: null,
        rootDiscoveryDelayMs: CONFIG.rootDiscovery.minDelayMs
    };

    /**
     * Inject custom CSS for offline devices
     */
    function injectStyles() {
        if (document.getElementById(CONFIG.styleId)) {
            return;
        }

        const style = document.createElement('style');
        style.id = CONFIG.styleId;
        style.textContent = `
            /* Offline device styling */
            ${CONFIG.selectors.gridItem}.${CONFIG.classes.offlineDevice} {
                position: relative;
                border-radius: 8px;
            }

            ${CONFIG.selectors.gridItem}.${CONFIG.classes.offlineDevice}::after {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 8px;
                background: ${CONFIG.styles.normal.backgroundColor};
                box-shadow:
                    0 0 0 2px ${CONFIG.styles.normal.borderColor} inset,
                    0 1px 4px rgba(0, 0, 0, 0.1);
                pointer-events: none;
                transition: box-shadow 0.2s ease, background 0.2s ease;
            }

            ${CONFIG.selectors.gridItem}.${CONFIG.classes.offlineDevice} ${CONFIG.selectors.deviceLink} {
                color: ${CONFIG.styles.normal.color} !important;
                text-decoration: none !important;
            }

            ${CONFIG.selectors.gridItem}.${CONFIG.classes.offlineDevice}:hover::after {
                background: rgba(255, 0, 0, 0.06);
                box-shadow:
                    0 0 0 2px ${CONFIG.styles.hover.borderColor} inset,
                    0 2px 10px rgba(0, 0, 0, 0.12);
            }

            ${CONFIG.selectors.gridItem}.${CONFIG.classes.offlineDevice}:hover ${CONFIG.selectors.deviceLink} {
                color: ${CONFIG.styles.hover.color} !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    /**
     * Function to highlight offline devices based on "Backup Created" text or "Offline" status.
     * (We process only affected grid items for performance.)
     */
    function processGridItem(gridItem) {
        if (!(gridItem instanceof Element)) return;

        const mainLink = gridItem.querySelector(CONFIG.selectors.deviceLink);
        if (!mainLink) return;

        const shouldHighlight = isOfflineDeviceTile(gridItem);
        gridItem.classList.toggle(CONFIG.classes.offlineDevice, shouldHighlight);
    }

    function isOfflineDeviceTile(gridItem) {
        const offlineSpan = gridItem.querySelector(CONFIG.selectors.offlineSpan);
        if (offlineSpan) {
            return true;
        }

        // Fallback: UniFi UI has historically used hashed CSS module classnames; rely on footer text.
        const footers = gridItem.querySelectorAll(CONFIG.selectors.tileFooter);
        for (const footer of footers) {
            const text = footer.textContent;
            if (!text) continue;
            const lower = text.toLowerCase();
            if (lower.includes(NEEDLES.offline) || lower.includes(NEEDLES.backupCreated)) {
                return true;
            }
        }

        // Last-chance fallback: some tiles expose status via aria-label/title.
        return Boolean(gridItem.querySelector(CONFIG.selectors.offlineAria));
    }

    function queueGridItem(gridItem) {
        if (!gridItem) return;
        state.pendingGridItems.add(gridItem);
        scheduleFlush();
    }

    function queueClosestGridItemFromNode(node) {
        if (!node) return;

        if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentElement;
            if (!parent) return;
            const gridItem = parent.closest(CONFIG.selectors.gridItem);
            if (gridItem) queueGridItem(gridItem);
            return;
        }

        if (!(node instanceof Element)) return;

        const gridItem = node.closest(CONFIG.selectors.gridItem);
        if (gridItem) queueGridItem(gridItem);
    }

    function queueGridItemsFromSubtree(node) {
        if (!node) return;

        if (node.nodeType === Node.TEXT_NODE) {
            queueClosestGridItemFromNode(node);
            return;
        }

        if (!(node instanceof Element)) return;

        if (node.matches(CONFIG.selectors.gridItem)) {
            queueGridItem(node);
            return;
        }

        const closestGridItem = node.closest(CONFIG.selectors.gridItem);
        if (closestGridItem) {
            queueGridItem(closestGridItem);
            return;
        }

        const gridItems = node.querySelectorAll(CONFIG.selectors.gridItem);
        for (const gridItem of gridItems) {
            queueGridItem(gridItem);
        }
    }

    function scheduleFlush() {
        if (state.flushScheduled) return;
        state.flushScheduled = true;

        requestAnimationFrame(() => {
            state.flushScheduled = false;
            flushPending();
        });
    }

    function flushPending() {
        if (state.pendingGridItems.size === 0) return;

        const items = Array.from(state.pendingGridItems);
        state.pendingGridItems.clear();

        for (const gridItem of items) {
            processGridItem(gridItem);
        }
    }

    function findGridRoot() {
        const firstDeviceLink = document.querySelector(
            `${CONFIG.selectors.gridItem} ${CONFIG.selectors.deviceLink}`
        );
        if (!firstDeviceLink) return null;

        const gridItem = firstDeviceLink.closest(CONFIG.selectors.gridItem);
        if (!gridItem) return null;

        return gridItem.closest(CONFIG.selectors.gridList) || gridItem.parentElement;
    }

    function attachObserverToGridRoot() {
        if (state.observedRoot && !document.contains(state.observedRoot)) {
            if (state.observer) state.observer.disconnect();
            state.observer = null;
            state.observedRoot = null;
        }

        const root = findGridRoot();
        if (!root) return false;

        if (state.observedRoot === root && state.observer) {
            queueExistingGridItems(root);
            return true;
        }

        state.observedRoot = root;
        if (state.observer) {
            state.observer.disconnect();
        }

        state.observer = new MutationObserver(handleMutations);
        state.observer.observe(root, {
            childList: true,
            subtree: true,
            characterData: true,
            characterDataOldValue: true,
            attributes: true,
            attributeFilter: ['class']
        });

        queueExistingGridItems(root);
        return true;
    }

    function queueExistingGridItems(root) {
        const gridItems = root.querySelectorAll(CONFIG.selectors.gridItem);
        for (const gridItem of gridItems) {
            queueGridItem(gridItem);
        }
    }

    function handleMutations(mutations) {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    queueGridItemsFromSubtree(node);
                }
                queueClosestGridItemFromNode(mutation.target);
                continue;
            }

            if (mutation.type === 'attributes') {
                if (!(mutation.target instanceof Element)) continue;
                if (!mutation.target.matches(CONFIG.selectors.tileFooter)) continue;
                queueClosestGridItemFromNode(mutation.target);
                continue;
            }

            if (mutation.type === 'characterData') {
                const newValue = mutation.target.data;
                const oldValue = mutation.oldValue;
                const mightAffectStatus = [newValue, oldValue].some(
                    (value) =>
                        typeof value === 'string' &&
                        (value.toLowerCase().includes(NEEDLES.offline) ||
                            value.toLowerCase().includes(NEEDLES.backupCreated))
                );
                if (!mightAffectStatus) continue;

                const parent = mutation.target.parentElement;
                if (!parent) continue;
                if (!parent.closest(CONFIG.selectors.tileFooter)) continue;
                queueClosestGridItemFromNode(mutation.target);
            }
        }
    }

    function scheduleRootDiscovery(resetDelay = false) {
        if (resetDelay) {
            state.rootDiscoveryDelayMs = CONFIG.rootDiscovery.minDelayMs;
        }

        if (state.rootDiscoveryTimer) return;
        state.rootDiscoveryTimer = window.setTimeout(() => {
            state.rootDiscoveryTimer = null;

            const attached = attachObserverToGridRoot();
            if (attached) return;

            state.rootDiscoveryDelayMs = Math.min(
                state.rootDiscoveryDelayMs * 2,
                CONFIG.rootDiscovery.maxDelayMs
            );
            scheduleRootDiscovery(false);
        }, state.rootDiscoveryDelayMs);
    }

    function hookSpaNavigation(onChange) {
        const notify = () => {
            try {
                onChange();
            } catch (error) {
                console.error('Error in UniFi Offline Highlighter navigation hook:', error);
            }
        };

        window.addEventListener('popstate', notify, { passive: true });
        window.addEventListener('hashchange', notify, { passive: true });

        const originalPushState = history.pushState;
        history.pushState = function (...args) {
            const result = originalPushState.apply(this, args);
            notify();
            return result;
        };

        const originalReplaceState = history.replaceState;
        history.replaceState = function (...args) {
            const result = originalReplaceState.apply(this, args);
            notify();
            return result;
        };
    }

    /**
     * Initialize the script
     */
    function init() {
        try {
            injectStyles();
            hookSpaNavigation(() => {
                const attached = attachObserverToGridRoot();
                if (!attached) scheduleRootDiscovery(true);
            });

            const attached = attachObserverToGridRoot();
            if (!attached) scheduleRootDiscovery(true);
        } catch (error) {
            console.error('Error initializing UniFi Offline Highlighter:', error);
        }
    }

    // Start the script
    init();
})();
