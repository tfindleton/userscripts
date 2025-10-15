// ==UserScript==
// @name         Hetzner Console - Estimated Euro to USD Converter
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  Appends estimated USD values below Euro amounts on console.hetzner.cloud without duplicating price periods.
// @match        https://console.hetzner.cloud/*
// @match        https://console.hetzner.com/*
// @icon         https://console.hetzner.cloud/favicon-32x32.png
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/hetzner/estimated-usd-pricing.js
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/hetzner/estimated-usd-pricing.js
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// ==/UserScript==

(function() {
    'use strict';

    // === Configuration ===
    const DEFAULT_EUR_TO_USD_RATE = 1.10; // Fallback rate
    const USD_COLOR = '#B2D9F5';
    const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms
    const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest/EUR';
    const STORAGE_PREFIX = 'hetzner_usd_converter_';
    const STORAGE_KEYS = {
        manualRate: `${STORAGE_PREFIX}manual_rate`
    };
    const hasGMStorage = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
    const canDeleteGMValue = typeof GM_deleteValue === 'function';
    // ======================

    let EUR_TO_USD_RATE = DEFAULT_EUR_TO_USD_RATE;
    let manualRateOverride = null;

    function parseStoredNumber(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const parsed = parseFloat(String(value));
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    function readLocalStorage(key) {
        try {
            return window.localStorage ? window.localStorage.getItem(key) : null;
        } catch (error) {
            console.debug('LocalStorage read failed', error);
            return null;
        }
    }

    function writeLocalStorage(key, value) {
        try {
            if (!window.localStorage) {
                return;
            }
            if (value === null) {
                window.localStorage.removeItem(key);
            } else {
                window.localStorage.setItem(key, String(value));
            }
        } catch (error) {
            console.debug('LocalStorage write failed', error);
        }
    }

    function persistManualRate(value) {
        if (hasGMStorage) {
            try {
                if (value === null) {
                    if (canDeleteGMValue) {
                        GM_deleteValue(STORAGE_KEYS.manualRate);
                    } else {
                        GM_setValue(STORAGE_KEYS.manualRate, null);
                    }
                } else {
                    GM_setValue(STORAGE_KEYS.manualRate, value);
                }
            } catch (error) {
                console.debug('GM storage write failed', error);
            }
        }
        writeLocalStorage(STORAGE_KEYS.manualRate, value);
    }

    function loadManualRateOverride() {
        let stored = null;
        if (hasGMStorage) {
            try {
                stored = GM_getValue(STORAGE_KEYS.manualRate, null);
            } catch (error) {
                console.debug('GM storage read failed', error);
            }
        }
        if (stored === null || stored === undefined || stored === '') {
            stored = readLocalStorage(STORAGE_KEYS.manualRate);
        }
        const parsed = parseStoredNumber(stored);
        if (parsed !== null) {
            manualRateOverride = parsed;
            EUR_TO_USD_RATE = parsed;
            console.log(`Using manual exchange rate override: 1 EUR = ${EUR_TO_USD_RATE} USD`);
        }
    }

    async function updateExchangeRate(force = false) {
        if (!force && manualRateOverride !== null) {
            console.log(`Manual exchange rate override active (${manualRateOverride}); skipping automatic update.`);
            return;
        }

        try {
            // Check if we need to update the rate (stored in localStorage)
            const savedRate = localStorage.getItem('eur_usd_rate');
            const lastUpdate = localStorage.getItem('eur_usd_rate_updated');
            const now = Date.now();
            
            if (savedRate && lastUpdate && (now - parseInt(lastUpdate)) < UPDATE_INTERVAL) {
                EUR_TO_USD_RATE = parseFloat(savedRate);
                console.log(`Using cached exchange rate: 1 EUR = ${EUR_TO_USD_RATE} USD`);
                return;
            }
            
            // Fetch current rate
            const response = await fetch(EXCHANGE_API_URL);
            const data = await response.json();
            
            if (data && data.rates && data.rates.USD) {
                EUR_TO_USD_RATE = data.rates.USD;
                localStorage.setItem('eur_usd_rate', EUR_TO_USD_RATE);
                localStorage.setItem('eur_usd_rate_updated', now.toString());
                console.log(`Updated exchange rate: 1 EUR = ${EUR_TO_USD_RATE} USD`);
            }
        } catch (error) {
            console.warn('Failed to fetch exchange rate, using default:', error);
        }
    }

    function formatUSD(amount, decimalPlaces) {
        return amount.toFixed(Math.max(decimalPlaces, 2));
    }

    function showToggleButtonIfNeeded() {
        const conversionsExist = document.querySelectorAll('.usd-estimate').length > 0;
        const toggleButton = document.getElementById('usd-toggle-button');
        
        if (toggleButton) {
            toggleButton.style.display = conversionsExist ? 'block' : 'none';
        }
    }

    function processPrice(priceElement) {
        try {
            const priceText = priceElement.textContent.trim();
            // More flexible regex to handle different Euro price formats
            const match = priceText.match(/€\s*([\d\.,]+)/);
            if (!match) return;

            // Handle comma as decimal separator in European format
            const euroString = match[1].replace(',', '.');
            const euroAmount = parseFloat(euroString);
            
            const decimals = match[1].includes('.') ? match[1].split('.')[1].length : 0;
            const usdAmount = euroAmount * EUR_TO_USD_RATE;
            const formattedUSD = formatUSD(usdAmount, decimals);

            // Check if USD estimate already exists
            let usdElement = priceElement.querySelector('.usd-estimate');
            if (!usdElement) {
                // Create new USD estimate element
                usdElement = document.createElement('div');
                usdElement.className = 'usd-estimate';
                usdElement.style.color = USD_COLOR;
                usdElement.style.marginTop = '2px';
                priceElement.appendChild(usdElement);
            }

            // Update USD estimate
            usdElement.textContent = `~$${formattedUSD}`;

            // Handle period text (e.g., "/mo" or "/h")
            const periodElement = priceElement.querySelector('.price-period, .price-month-label');
            if (periodElement) {
                const periodText = periodElement.textContent.trim();

                // === OPTION 1: Stack prices (uncomment this block to enable) ===
                // usdElement.textContent = `~$${formattedUSD} ${periodText}`;
                // periodElement.style.display = "none"; // Hide the original period

                // === OPTION 2: Remove period from USD estimate (uncomment this block to enable) ===
                usdElement.textContent = `~$${formattedUSD}`;
                // Period will only be shown with Euro amount

                // Move the original period element after the USD estimate
                usdElement.parentNode.insertBefore(periodElement, usdElement.nextSibling);
            }
            
            // Show toggle button when conversions exist
            showToggleButtonIfNeeded();
        } catch (error) {
            console.warn('Error processing price element:', error, priceElement);
        }
    }

    function processPrices(container) {
        // Target various price elements
        const priceElements = container.querySelectorAll('.price-amount, .col--price, .usage-table__table-cell:last-child, .hc-table__foot-calc-sum');
        priceElements.forEach(processPrice);
        
        // Check if we should show the toggle button
        showToggleButtonIfNeeded();
    }

    async function promptForCustomRate() {
        const currentRate = manualRateOverride !== null ? manualRateOverride : EUR_TO_USD_RATE;
        const message = 'Enter EUR to USD exchange rate (leave blank to use automatic updates):';
        const userInput = prompt(message, currentRate.toString());
        if (userInput === null) {
            return;
        }

        const trimmed = userInput.trim();

        if (trimmed === '') {
            manualRateOverride = null;
            persistManualRate(null);
            await updateExchangeRate(true);
            processPrices(document.body);
            return;
        }

        const normalized = trimmed.replace(',', '.');
        const parsed = parseFloat(normalized);

        if (!Number.isFinite(parsed) || parsed <= 0) {
            alert('Please enter a valid positive number.');
            return;
        }

        manualRateOverride = parsed;
        EUR_TO_USD_RATE = parsed;
        persistManualRate(parsed);
        processPrices(document.body);
    }

    function registerSettings() {
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand("Configure USD Converter", () => {
                promptForCustomRate();
            });
        }
    }

    function addStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .usd-estimate {
                color: ${USD_COLOR};
                margin-top: 2px;
                font-size: 0.9em;
                opacity: 0.9;
            }
        `;
        document.head.appendChild(styleElement);
    }

    function addToggleButton(onConfigure) {
        const button = document.createElement('button');
        button.id = 'usd-toggle-button';
        button.textContent = "Hide USD";
        button.style.position = "fixed";
        button.style.bottom = "10px";
        button.style.left = "50%"; // Center horizontally
        button.style.transform = "translateX(-50%)"; // Offset by half width for true centering
        button.style.zIndex = "9999";
        button.style.padding = "8px 12px"; // Slightly larger padding for better clickability
        button.style.opacity = "0.7";
        button.style.borderRadius = "4px"; // Rounded corners
        button.style.border = "1px solid #ccc";
        button.style.backgroundColor = "#f5f5f5";
        button.style.cursor = "pointer"; // Hand cursor on hover
        button.style.color = "#000";
        button.style.display = "none"; // Hidden by default
        button.title = onConfigure
            ? 'Click to hide/show USD estimates. Hold Ctrl (or Cmd) while clicking to configure the exchange rate.'
            : 'Click to hide/show USD estimates.';

        // Hover effect
        button.onmouseover = () => { 
            button.style.opacity = "1.0";
        };
        button.onmouseout = () => {
            button.style.opacity = "0.7";
        };
        
        let enabled = true;
        button.addEventListener('click', async (event) => {
            if (onConfigure && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                await onConfigure();
                return;
            }

            enabled = !enabled;
            document.querySelectorAll('.usd-estimate').forEach(el => {
                el.style.display = enabled ? 'block' : 'none';
            });
            button.textContent = enabled ? "Hide USD" : "Show USD";
        });
        
        document.body.appendChild(button);
    }

    function initializeConversion() {
        loadManualRateOverride();
        updateExchangeRate();
        processPrices(document.body);
        registerSettings();
        addStyles();
        addToggleButton(promptForCustomRate);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            processPrices(node);
                        }
                    });
                } else if (mutation.type === 'characterData') {
                    const targetElement = mutation.target.parentElement;
                    if (targetElement && (targetElement.classList.contains('price-amount') || targetElement.classList.contains('col--price'))) {
                        processPrice(targetElement);
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        console.log(`Euro to USD conversion script initialized with rate: 1 EUR = ${EUR_TO_USD_RATE} USD`);
    }

    initializeConversion();
})();
