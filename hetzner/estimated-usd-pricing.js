// ==UserScript==
// @name         Simple Euro to USD Converter for Hetzner Console
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  Appends estimated USD values below Euro amounts on console.hetzner.cloud
// @match        https://console.hetzner.cloud/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/hetzner/estimated-usd-pricing.js
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/hetzner/estimated-usd-pricing.js
// ==/UserScript==

(function() {
    'use strict';

    // === Configuration ===
    // Set your desired EUR to USD exchange rate here.
    // Example: 1 EUR = 1.10 USD
    const EUR_TO_USD_RATE = 1.10;
    // ======================

    // WeakSet to keep track of processed text nodes
    const processedNodes = new WeakSet();

    /**
     * Formats the USD amount based on the number of decimal places in the Euro amount.
     * Removes trailing zeros beyond two decimal places.
     * @param {number} amount - The calculated USD amount.
     * @param {number} decimalPlaces - The number of decimal places in the Euro amount.
     * @returns {string} - The formatted USD amount.
     */
    function formatUSD(amount, decimalPlaces) {
        if (decimalPlaces <= 2){
            return amount.toFixed(decimalPlaces);
        } else {
            // Round down to three decimal places
            const rounded = Math.floor(amount * 1000) / 1000;
            // Convert to string with three decimal places
            let usdString = rounded.toFixed(3);
            // Remove the third decimal if it's zero
            if (usdString.endsWith('0')) {
                usdString = usdString.slice(0, -1);
            }
            return usdString;
        }
    }

    /**
     * Processes a single text node to find and append USD equivalents.
     * @param {Text} textNode - The text node to process.
     */
    function processTextNode(textNode) {
        // If the node is already processed, skip
        if (processedNodes.has(textNode)) {
            return;
        }

        const originalText = textNode.nodeValue;
        // Regular expression to find '€' followed by a number, e.g., €3.16 or €0.006
        // Negative lookahead to ensure it hasn't been processed yet (i.e., not followed by ' ~$')
        const euroAmountRegex = /€\s?(\d+(?:\.\d{1,3})?)(?!\s*~\$)/g;

        let match;
        const matches = [];

        // Collect all matches first
        while ((match = euroAmountRegex.exec(originalText)) !== null) {
            matches.push({
                text: match[0],
                amount: parseFloat(match[1]),
                index: match.index,
                length: match[0].length,
                decimals: match[1].includes('.') ? match[1].split('.')[1].length : 0
            });
        }

        // If no matches, mark as processed and return
        if (matches.length === 0) {
            processedNodes.add(textNode);
            return;
        }

        // Iterate over matches from the end to avoid messing up indices
        for (let i = matches.length -1; i >=0; i--) {
            const { text, amount, index, length, decimals } = matches[i];
            const usdAmount = amount * EUR_TO_USD_RATE;
            const formattedUSD = formatUSD(usdAmount, decimals);

            // Split the text node at the end of the match
            const afterMatch = textNode.splitText(index + length);

            // Create a <br> element
            const br = document.createElement('br');

            // Create a text node with the USD amount
            const usdTextNode = document.createTextNode(`~$${formattedUSD}`);

            // Insert <br> and USD text node
            afterMatch.parentNode.insertBefore(br, afterMatch);
            afterMatch.parentNode.insertBefore(usdTextNode, afterMatch);
        }

        // Mark the node as processed to prevent reprocessing
        processedNodes.add(textNode);
    }

    /**
     * Traverses the DOM to find and process all relevant text nodes.
     * @param {Node} rootNode - The root node to start traversal.
     */
    function traverseDOM(rootNode) {
        const walker = document.createTreeWalker(
            rootNode,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        const textNodes = [];

        // Collect all text nodes first to avoid live traversal issues
        while ((node = walker.nextNode())) {
            if (node.nodeValue.includes('€')) {
                textNodes.push(node);
            }
        }

        // Process each collected text node
        textNodes.forEach(node => processTextNode(node));
    }

    /**
     * Initializes the conversion process and sets up the MutationObserver.
     */
    function initializeConversion() {
        // Initial traversal and processing
        traverseDOM(document.body);
        console.log(`Euro to USD conversion script initialized with rate: 1 EUR = ${EUR_TO_USD_RATE} USD`);

        // Set up a MutationObserver to handle dynamic content
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        if (node.nodeValue.includes('€')) {
                            processTextNode(node);
                        }
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        traverseDOM(node);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Run the conversion
    initializeConversion();

})();
