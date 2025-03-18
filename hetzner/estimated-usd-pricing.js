// ==UserScript==
// @name         Hetzner Console - Estimated Euro to USD Converter
// @namespace    http://tampermonkey.net/
// @version      1.0.6
// @description  Appends estimated USD values below Euro amounts on console.hetzner.cloud without duplicating price periods.
// @match        https://console.hetzner.cloud/*
// @icon         https://console.hetzner.cloud/favicon-32x32.png
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/hetzner/estimated-usd-pricing.js
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/hetzner/estimated-usd-pricing.js
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // === Configuration ===
    const DEFAULT_EUR_TO_USD_RATE = 1.10; // Fallback rate
    const USD_COLOR = '#B2D9F5';
    const UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms
    const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest/EUR';
    // ======================

    let EUR_TO_USD_RATE = DEFAULT_EUR_TO_USD_RATE;

    async function updateExchangeRate() {
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

    function registerSettings() {
        GM_registerMenuCommand("Configure USD Converter", () => {
            const newRate = prompt("Enter EUR to USD exchange rate:", GM_getValue("exchangeRate", DEFAULT_EUR_TO_USD_RATE));
            if (newRate && !isNaN(parseFloat(newRate))) {
                GM_setValue("exchangeRate", parseFloat(newRate));
                EUR_TO_USD_RATE = parseFloat(newRate);
                // Refresh prices
                processPrices(document.body);
            }
        });
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

    function addToggleButton() {
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
        
        // Hover effect
        button.onmouseover = () => { 
            button.style.opacity = "1.0";
        };
        button.onmouseout = () => {
            button.style.opacity = "0.7";
        };
        
        let enabled = true;
        button.onclick = () => {
            enabled = !enabled;
            document.querySelectorAll('.usd-estimate').forEach(el => {
                el.style.display = enabled ? 'block' : 'none';
            });
            button.textContent = enabled ? "Hide USD" : "Show USD";
        };
        
        document.body.appendChild(button);
    }

    function initializeConversion() {
        updateExchangeRate();
        processPrices(document.body);
        registerSettings();
        addStyles();
        addToggleButton();

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
