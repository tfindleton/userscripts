// ==UserScript==
// @name         Hetzner Console - Estimated Euro to USD Converter
// @namespace    http://tampermonkey.net/
// @version      1.1.3
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
    let currentCurrency = 'EUR';
    let toggleButton = null;

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
        let rateUpdated = false;
        if (!force && manualRateOverride !== null) {
            console.log(`Manual exchange rate override active (${manualRateOverride}); skipping automatic update.`);
            return;
        }

        try {
            // Check if we need to update the rate (stored in localStorage)
            const savedRate = localStorage.getItem('eur_usd_rate');
            const lastUpdate = localStorage.getItem('eur_usd_rate_updated');
            const now = Date.now();

            if (savedRate && lastUpdate && (now - parseInt(lastUpdate, 10)) < UPDATE_INTERVAL) {
                EUR_TO_USD_RATE = parseFloat(savedRate);
                rateUpdated = true;
                console.log(`Using cached exchange rate: 1 EUR = ${EUR_TO_USD_RATE} USD`);
            } else {
                // Fetch current rate
                const response = await fetch(EXCHANGE_API_URL);
                const data = await response.json();

                if (data && data.rates && data.rates.USD) {
                    EUR_TO_USD_RATE = data.rates.USD;
                    localStorage.setItem('eur_usd_rate', EUR_TO_USD_RATE);
                    localStorage.setItem('eur_usd_rate_updated', now.toString());
                    rateUpdated = true;
                    console.log(`Updated exchange rate: 1 EUR = ${EUR_TO_USD_RATE} USD`);
                }
            }
        } catch (error) {
            console.warn('Failed to fetch exchange rate, using default:', error);
        } finally {
            if (rateUpdated) {
                processPrices(document.body);
            }
        }
    }

    function formatUSD(amount, decimalPlaces) {
        return amount.toFixed(Math.max(decimalPlaces, 2));
    }

    function containsEuro(text) {
        return typeof text === 'string' && text.includes('€');
    }

    function showToggleButtonIfNeeded() {
        if (!toggleButton) {
            return;
        }
        const conversionsExist = document.querySelectorAll('.price-switcher__usd').length > 0;
        toggleButton.style.display = conversionsExist ? 'block' : 'none';
        if (conversionsExist) {
            updateToggleButtonLabel();
        }
    }

    function findEuroTextNode(element) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!containsEuro(node.textContent)) {
                    return NodeFilter.FILTER_SKIP;
                }
                if (node.parentElement && node.parentElement.closest('.price-switcher')) {
                    return NodeFilter.FILTER_SKIP;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        return walker.nextNode();
    }

    function normalizeEuroDisplay(rawDisplay) {
        return rawDisplay.replace(/^\s+|\s+$/g, '');
    }

    function parseEuroAmount(rawDigits) {
        const cleaned = rawDigits.replace(/\s/g, '');
        if (cleaned.includes(',')) {
            const stripped = cleaned.replace(/\./g, '');
            return parseFloat(stripped.replace(',', '.'));
        }
        return parseFloat(cleaned.replace(/[^0-9.]/g, ''));
    }

    function buildPriceWrapper(euroDisplay, usdDisplay, euroAmount, decimals) {
        const wrapper = document.createElement('span');
        wrapper.className = 'price-switcher';
        wrapper.dataset.originalEuro = euroDisplay;
        wrapper.dataset.euroAmount = String(euroAmount);
        wrapper.dataset.decimals = String(decimals);

        const euroSpan = document.createElement('span');
        euroSpan.className = 'price-switcher__eur';
        euroSpan.textContent = euroDisplay;
        euroSpan.title = `$${usdDisplay} USD`;
        euroSpan.setAttribute('aria-label', `$${usdDisplay} USD`);

        const usdSpan = document.createElement('span');
        usdSpan.className = 'price-switcher__usd usd-estimate';
        usdSpan.textContent = `$${usdDisplay}`;
        usdSpan.title = `Original price ${euroDisplay}`;
        usdSpan.setAttribute('aria-label', `Original price ${euroDisplay}`);

        wrapper.appendChild(euroSpan);
        wrapper.appendChild(usdSpan);

        return wrapper;
    }

    function updateWrapper(wrapper) {
        const euroSpan = wrapper.querySelector('.price-switcher__eur');
        const usdSpan = wrapper.querySelector('.price-switcher__usd');
        if (!euroSpan || !usdSpan) {
            return;
        }

        let euroDisplay = euroSpan.textContent ? normalizeEuroDisplay(euroSpan.textContent) : '';
        if (!euroDisplay) {
            euroDisplay = wrapper.dataset.originalEuro || '';
        }

        const match = euroDisplay.match(/€\s*([\d\.,]+)/);
        if (!match) {
            return;
        }

        const euroDigits = match[1];
        const decimals = euroDigits.includes(',') || euroDigits.includes('.')
            ? euroDigits.split(/[.,]/).pop().length
            : parseInt(wrapper.dataset.decimals || '2', 10);
        const euroAmount = parseEuroAmount(euroDigits);

        if (Number.isFinite(euroAmount)) {
            wrapper.dataset.originalEuro = euroDisplay;
            wrapper.dataset.euroAmount = String(euroAmount);
            wrapper.dataset.decimals = String(decimals);
            const usdDisplay = formatUSD(euroAmount * EUR_TO_USD_RATE, decimals);
            euroSpan.title = `$${usdDisplay} USD`;
            euroSpan.setAttribute('aria-label', `$${usdDisplay} USD`);
            usdSpan.textContent = `$${usdDisplay}`;
            const tooltip = `Original price ${euroDisplay}`;
            usdSpan.title = tooltip;
            usdSpan.setAttribute('aria-label', tooltip);
        }

        applyCurrencyViewToWrapper(wrapper);
    }

    function applyCurrencyViewToWrapper(wrapper) {
        const euroSpan = wrapper.querySelector('.price-switcher__eur');
        const usdSpan = wrapper.querySelector('.price-switcher__usd');
        if (!euroSpan || !usdSpan) {
            return;
        }

        if (currentCurrency === 'USD') {
            euroSpan.style.display = 'none';
            usdSpan.style.display = 'inline';
        } else {
            euroSpan.style.display = 'inline';
            usdSpan.style.display = 'none';
        }
    }

    function applyCurrencyView() {
        document.querySelectorAll('.price-switcher').forEach(applyCurrencyViewToWrapper);
        updateToggleButtonLabel();
    }

    function updateToggleButtonLabel() {
        if (!toggleButton) {
            return;
        }
        const rateDisplay = formatUSD(EUR_TO_USD_RATE, 3);
        const nextLabel = currentCurrency === 'EUR' ? 'show as usd' : 'show as euro';
        toggleButton.textContent = `${nextLabel} (1€ ~ $${rateDisplay})`;
    }

    function insertWrapperForTextNode(textNode, wrapper) {
        const original = textNode.textContent;
        const leadingMatch = original.match(/^(\s*)/);
        const trailingMatch = original.match(/(\s*)$/);
        const leading = leadingMatch ? leadingMatch[0] : '';
        const trailing = trailingMatch ? trailingMatch[0] : '';

        const fragment = document.createDocumentFragment();
        if (leading) {
            fragment.appendChild(document.createTextNode(leading));
        }
        fragment.appendChild(wrapper);
        if (trailing) {
            fragment.appendChild(document.createTextNode(trailing));
        }

        textNode.parentNode.replaceChild(fragment, textNode);
    }

    function processPrice(priceElement) {
        try {
            // Remove any legacy USD nodes we may have injected previously
            priceElement.querySelectorAll('.usd-estimate').forEach(node => {
                if (!node.closest('.price-switcher')) {
                    node.remove();
                }
            });

            const directWrapper = priceElement.closest('.price-switcher');
            if (directWrapper) {
                updateWrapper(directWrapper);
                return;
            }

            const existingWrappers = priceElement.querySelectorAll(':scope .price-switcher');
            if (existingWrappers.length > 0) {
                existingWrappers.forEach(updateWrapper);
                return;
            }

            const euroTextNode = findEuroTextNode(priceElement);
            if (!euroTextNode) {
                return;
            }

            const nodeMatch = euroTextNode.textContent.match(/€\s*([\d\.,]+)/);
            if (!nodeMatch) {
                return;
            }

            const euroDigits = nodeMatch[1];
            const euroDisplay = normalizeEuroDisplay(nodeMatch[0]);
            const euroAmount = parseEuroAmount(euroDigits);
            if (!Number.isFinite(euroAmount)) {
                return;
            }

            const decimals = euroDigits.includes(',') || euroDigits.includes('.')
                ? euroDigits.split(/[.,]/).pop().length
                : 0;
            const usdDisplay = formatUSD(euroAmount * EUR_TO_USD_RATE, decimals);

            const wrapper = buildPriceWrapper(euroDisplay, usdDisplay, euroAmount, decimals);
            insertWrapperForTextNode(euroTextNode, wrapper);
            applyCurrencyViewToWrapper(wrapper);
        } catch (error) {
            console.warn('Error processing price element:', error, priceElement);
        }
    }

    function collectPriceCandidates(container) {
        const selectorList = [
            '.price',
            '.price-amount',
            '.col--price',
            '.col--price-monthly',
            '.col--price-total',
            '.col--price-upfront',
            '.types-list__col--price-monthly',
            '.types-list__col--price-total',
            '.types-list__col--price-upfront',
            '.usage-table__table-cell',
            '.hc-table__foot-calc-sum',
            '[class*="price"]'
        ];

        const candidates = new Set();
        const selector = selectorList.join(', ');

        if (typeof container.matches === 'function' && container.matches(selector)) {
            candidates.add(container);
        }

        if (typeof container.querySelectorAll === 'function') {
            container.querySelectorAll(selector).forEach(el => candidates.add(el));
        }

        return Array.from(candidates).filter(el => {
            if (!(el instanceof Element)) {
                return false;
            }
            if (el.closest('.usd-estimate')) {
                return false;
            }
            return containsEuro(el.textContent);
        });
    }

    function processPrices(container) {
        const candidates = collectPriceCandidates(container);
        const filtered = candidates.filter(el => !candidates.some(other => other !== el && el.contains(other) && containsEuro(other.textContent)));

        filtered.forEach(processPrice);

        // Check if we should show the toggle button
        showToggleButtonIfNeeded();
        applyCurrencyView();
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
            .price-switcher {
                display: inline-flex;
                align-items: baseline;
                gap: 0.35em;
            }
            .price-switcher__eur,
            .price-switcher__usd {
                font-size: 0.96em;
            }
            .usd-estimate {
                color: ${USD_COLOR};
                font-weight: 600;
            }
        `;
        document.head.appendChild(styleElement);
    }

    function addToggleButton(onConfigure) {
        const button = document.createElement('button');
        button.id = 'usd-toggle-button';
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
            ? 'Click to toggle displayed currency. Hold Ctrl (or Cmd) while clicking to configure the exchange rate.'
            : 'Click to toggle displayed currency.';

        // Hover effect
        button.onmouseover = () => { 
            button.style.opacity = "1.0";
        };
        button.onmouseout = () => {
            button.style.opacity = "0.7";
        };
        
        button.addEventListener('click', async (event) => {
            if (onConfigure && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                await onConfigure();
                return;
            }

            currentCurrency = currentCurrency === 'EUR' ? 'USD' : 'EUR';
            applyCurrencyView();
            updateToggleButtonLabel();
        });

        document.body.appendChild(button);
        toggleButton = button;
        updateToggleButtonLabel();
        return button;
    }

    function initializeConversion() {
        loadManualRateOverride();
        updateExchangeRate();
        processPrices(document.body);
        registerSettings();
        addStyles();
        addToggleButton(promptForCustomRate);
        applyCurrencyView();
        showToggleButtonIfNeeded();

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
                    if (!targetElement) {
                        return;
                    }

                    const wrapper = targetElement.closest('.price-switcher');
                    if (wrapper) {
                        updateWrapper(wrapper);
                        showToggleButtonIfNeeded();
                        applyCurrencyView();
                        return;
                    }

                    if (targetElement.classList.contains('price-amount') || targetElement.classList.contains('col--price')) {
                        processPrice(targetElement);
                        showToggleButtonIfNeeded();
                        applyCurrencyView();
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
