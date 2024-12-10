// ==UserScript==
// @name         Hetzner Console - Estimated Euro to USD Converter
// @namespace    http://tampermonkey.net/
// @version      1.0.4
// @description  Appends estimated USD values below Euro amounts on console.hetzner.cloud without duplicating price periods.
// @match        https://console.hetzner.cloud/*
// @icon         https://console.hetzner.cloud/favicon-32x32.png
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/hetzner/estimated-usd-pricing.js
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/hetzner/estimated-usd-pricing.js
// ==/UserScript==

(function() {
    'use strict';

    // === Configuration ===
    const EUR_TO_USD_RATE = 1.10;
    const USD_COLOR = '#B2D9F5';
    // ======================

    function formatUSD(amount, decimalPlaces) {
        return amount.toFixed(Math.max(decimalPlaces, 2));
    }

    function processPrice(priceElement) {
        const priceText = priceElement.textContent.trim();
        const match = priceText.match(/€\s?(\d+(?:\.\d{1,3})?)/);
        if (!match) return;

        const euroAmount = parseFloat(match[1]);
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
    }

    function processPrices(container) {
        // Target various price elements
        const priceElements = container.querySelectorAll('.price-amount, .col--price, .usage-table__table-cell:last-child, .hc-table__foot-calc-sum');
        priceElements.forEach(processPrice);
    }

    function initializeConversion() {
        processPrices(document.body);

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
