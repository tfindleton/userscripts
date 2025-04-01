// ==UserScript==
// @name         InHand Signal Levels + Hover Explanation
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Color-coded signal readings for InHand IR300/IR600, plus hover tooltip with measure explanation & thresholds. Keeps tooltip on-screen.
// @match        https://iot.inhandnetworks.com/*
// @grant        GM_addStyle
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/inhand/inhand-signals.js
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/inhand/inhand-signals.js
// ==/UserScript==

(function() {
    'use strict';

    /**********************************************************
     * A) Global CSS for labels, tooltip, and styling
     **********************************************************/
    GM_addStyle(`
      /* The color-coded label replacing the default reading */
      .signal-label-badge {
        display: inline-block;
        margin-left: 4px;
        padding: 4px 8px;
        font-weight: bold;
        border-radius: 4px;
        color: #fff;
        text-shadow: 1px 1px 2px #000; /* Improves contrast on brighter colors */
        position: relative;
      }

      /* Container for the "?" icon with a tooltip on hover */
      .signal-tooltip-container {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        margin-left: 6px;
        font-weight: bold;
        user-select: none;
        color: #fff;
        background-color: #007bff;
        border-radius: 50%;
        width: 18px;
        height: 18px;
        font-size: 12px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        transition: background-color 0.2s ease;
      }

      .signal-tooltip-container:hover {
        background-color: #0056b3;
      }

      /* The actual tooltip text. Hidden until hover. */
      .signal-tooltip-text {
        display: none;
        position: absolute;
        width: max-content; /* shrink-to-fit the text */
        max-width: 300px;   /* prevent extremely wide boxes */
        background-color: rgba(0, 0, 0, 0.85);
        color: #fff;
        padding: 8px 12px;
        border-radius: 5px;
        z-index: 99999;
        left: 50%;
        transform: translateX(-50%);
        bottom: 125%; /* appear above the "?" icon */
        white-space: pre-line; /* allow line wraps */
        font-size: 13px;
        text-shadow: none; /* keep tooltip text sharp */
        line-height: 1.4;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
    `);

    /**********************************************************
     * B) Hover handling to show/hide & keep tooltip on-screen
     **********************************************************/
    function showTooltip(tooltipEl) {
        // Make it visible
        tooltipEl.style.display = 'block';

        // Use requestAnimationFrame so the element has a layout
        requestAnimationFrame(() => {
            const rect = tooltipEl.getBoundingClientRect();

            // SHIFT LEFT/RIGHT if off-screen horizontally
            let shiftX = 0;

            // If tooltip extends past right edge, shift left
            const offRight = rect.right - window.innerWidth;
            if (offRight > 0) {
                shiftX = offRight + 10; // add a bit of padding
            }
            // If tooltip extends past left edge, shift right
            if (rect.left < 0) {
                // negative left => shiftX = rect.left - 10
                shiftX = rect.left - 10;
            }
            if (shiftX !== 0) {
                tooltipEl.style.transform = `translateX(calc(-50% - ${shiftX}px))`;
            }

            // SHIFT UP/DOWN if off-screen vertically
            if (rect.top < 0) {
                // If near top, let's push it below instead:
                // we do bottom: auto, top: 125%
                tooltipEl.style.bottom = 'auto';
                tooltipEl.style.top = '125%';
            }
            // If near bottom edge, we might want to clamp, but typically it won't happen
            // because the "?" icon is presumably not near bottom. If needed, you can add logic.
        });
    }

    function hideTooltip(tooltipEl) {
        // Reset any transform or top/bottom adjustments
        tooltipEl.style.display = 'none';
        tooltipEl.style.transform = 'translateX(-50%)';
        tooltipEl.style.bottom = '125%';
        tooltipEl.style.top = 'auto';
    }

    /**********************************************************
     * C) Provide brief explanations for each measure
     **********************************************************/
    const measureExplanations = {
        'Signal Strength':
            'Signal Strength indicator (scale 0-30):\nShows cellular connection quality using the same color scheme as device LEDs. Higher values mean better connection.\n\nTo improve: Reposition the device higher up, closer to windows, or away from metal objects and concrete walls.',
        'RSSI':
            'RSSI (Received Signal Strength Indicator):\nMeasures the power of the cellular signal in dBm. Closer to 0 means stronger signal, with -67dBm or better considered excellent.\n\nTo improve: Try different locations within your building, especially near windows facing the nearest cell tower.',
        'RSRP':
            'RSRP (Reference Signal Received Power):\nIndicates the power of the 4G/LTE signal reaching your device. Similar to RSSI but more precise for LTE networks.\n\nTo improve: Move the device to a higher elevation and away from obstacles like thick walls or metal fixtures.',
        'RSRQ':
            'RSRQ (Reference Signal Received Quality):\nShows the quality of the received signal, accounting for interference and noise. Higher values (closer to 0) indicate cleaner signal.\n\nTo improve: Move away from sources of interference like microwaves, Wi-Fi routers, and other electronic devices.',
        'SINR':
            'SINR (Signal to Interference + Noise Ratio):\nMeasures signal clarity by comparing desired signal to background interference. Higher positive numbers mean clearer transmission.\n\nTo improve: Isolate the device from other electronics and try different orientations or positions in the room.'
    };

    /**********************************************************
     * D) Threshold configurations for each recognized measure
     *    (From best to worst)
     **********************************************************/
    const measureConfigs = {
        // Signal Strength (IR300/IR600 LED style)
        'Signal Strength': [
            { desc: 'Green (21–30)',   min: 21, color: '#28a745' },
            { desc: 'Yellow (11–20)',  min: 11, color: '#FF9800' },
            { desc: 'Red (0–10)',      min: 0,  color: '#dc3545' }
        ],

        // RSSI: ≥ -67 => Excellent, ≥ -80 => Good, ≥ -90 => Fair, < -90 => Poor
        'RSSI': [
            { desc: 'Excellent (≥ -67)', min: -67,   color: '#006400' },
            { desc: 'Good (≥ -80)',      min: -80,   color: '#28a745' },
            { desc: 'Fair (≥ -90)',      min: -90,   color: '#FF9800' },
            { desc: 'Poor (< -90)',      min: -9999, color: '#dc3545' }
        ],

        // RSRP: ≥ -80 => Excellent, ≥ -90 => Good, ≥ -100 => Fair, < -100 => Poor
        'RSRP': [
            { desc: 'Excellent (≥ -80)', min: -80,   color: '#006400' },
            { desc: 'Good (≥ -90)',      min: -90,   color: '#28a745' },
            { desc: 'Fair (≥ -100)',     min: -100,  color: '#FF9800' },
            { desc: 'Poor (< -100)',     min: -9999, color: '#dc3545' }
        ],

        // RSRQ: ≥ -10 => Good, ≥ -15 => Fair, < -15 => Poor
        'RSRQ': [
            { desc: 'Good (≥ -10)',  min: -10,   color: '#28a745' },
            { desc: 'Fair (≥ -15)',  min: -15,   color: '#FF9800' },
            { desc: 'Poor (< -15)',  min: -9999, color: '#dc3545' }
        ],

        // SINR: ≥ 20 => Excellent, ≥ 13 => Good, ≥ 6 => Average, ≥ 0 => Low, < 0 => Very Low
        'SINR': [
            { desc: 'Excellent (≥ 20)', min: 20,   color: '#006400' },
            { desc: 'Good (≥ 13)',      min: 13,   color: '#28a745' },
            { desc: 'Average (≥ 6)',    min: 6,    color: '#939F22' },
            { desc: 'Low (≥ 0)',        min: 0,    color: '#EE6722' },
            { desc: 'Very Low (< 0)',   min: -9999,color: '#dc3545' }
        ]
    };

    /**********************************************************
     * E) Parsing & threshold logic
     **********************************************************/
    function parseValue(strValue) {
        const cleaned = strValue.replace(/[^\-\d.]/g, '');
        return parseFloat(cleaned) || 0;
    }

    function getLabelAndColor(measureName, numericValue) {
        const config = measureConfigs[measureName];
        if (!config) return null;
        // Find the first threshold that numericValue >= min
        for (let i = 0; i < config.length; i++) {
            const item = config[i];
            if (numericValue >= item.min) {
                return { 
                    desc: item.desc, 
                    color: item.color
                };
            }
        }
        return null;
    }

    // Build multiline tooltip text:
    // - First: short explanation from measureExplanations (if present)
    // - Then: lines for each threshold desc
    function buildTooltipText(measureName) {
        const explanation = measureExplanations[measureName] || '';
        const thresholds = measureConfigs[measureName];
        if (!thresholds) return explanation || 'No thresholds defined.';

        // Format explanation text to highlight the improvement tip
        let formattedExplanation = '';
        if (explanation) {
            const parts = explanation.split('\n\nTo improve:');
            formattedExplanation = parts[0];
            if (parts.length > 1) {
                formattedExplanation += '\n\n📈 To improve:' + parts[1];
            }
        }

        let text = formattedExplanation;
        // Add a blank line if we have both explanation + thresholds
        if (explanation && thresholds.length > 0) {
            text += '\n\nRanges:\n';
        } else if (thresholds.length > 0) {
            text += 'Ranges:\n';
        }
        thresholds.forEach(item => {
            text += item.desc + '\n';
        });
        return text.trim();
    }

    /**********************************************************
     * F) Modify each recognized measure in .ant-card-extra
     **********************************************************/
    function patchSignalCard(card) {
        const titleEl = card.querySelector('.ant-card-head-title');
        if (!titleEl) return;
        const measureName = titleEl.textContent.trim();

        // Only proceed if measure is recognized
        if (!measureConfigs[measureName]) return;

        const extraEl = card.querySelector('.ant-card-extra');
        if (!extraEl) return;

        // Already patched? skip
        if (extraEl.dataset.signalPatched === 'yes') return;

        // The reading div is now wrapped in an additional div
        const readingDiv = extraEl.querySelector('div');
        if (!readingDiv) return;

        // Find the first span in the container (which contains the reading)
        const readingSpan = readingDiv.querySelector('span');
        if (!readingSpan) return;

        const readingStr = readingSpan.textContent.trim();
        const readingNum = parseValue(readingStr);

        // Extract text before the span for label context
        const labelText = readingDiv.textContent.split(readingStr)[0].trim();

        // Determine label & color
        const result = getLabelAndColor(measureName, readingNum);
        if (!result) return;
        const { desc, color } = result;

        // Clear the original text
        extraEl.innerHTML = '';

        // Build the color-coded badge
        // Example: "-81 dBm => Fair (≥ -90)"
        const labelBadge = document.createElement('span');
        labelBadge.className = 'signal-label-badge';
        labelBadge.style.backgroundColor = color;
        
        let displayText = readingStr;
        // Add any unit or context from the label if available
        if (labelText) {
            const unitMatch = labelText.match(/^Latest\s+[\w\s]+:/);
            if (unitMatch) {
                // Just use the reading and the description
                displayText = `${readingStr} => ${desc}`;
            }
        } else {
            displayText += ` => ${desc}`;
        }
        labelBadge.textContent = displayText;

        // Create "?" icon w/ tooltip
        const tooltipContainer = document.createElement('span');
        tooltipContainer.className = 'signal-tooltip-container';
        tooltipContainer.textContent = '?';

        const tooltipTextEl = document.createElement('div');
        tooltipTextEl.className = 'signal-tooltip-text';
        tooltipTextEl.textContent = buildTooltipText(measureName);

        // Insert the tooltip box
        tooltipContainer.appendChild(tooltipTextEl);

        // Show/hide with pointer events (to keep it on screen)
        tooltipContainer.addEventListener('pointerenter', () => {
            showTooltip(tooltipTextEl);
        });
        tooltipContainer.addEventListener('pointerleave', () => {
            hideTooltip(tooltipTextEl);
        });

        // Append to .ant-card-extra
        extraEl.appendChild(labelBadge);
        extraEl.appendChild(tooltipContainer);

        // Mark as patched
        extraEl.dataset.signalPatched = 'yes';
    }

    function patchAllSignalCards() {
        // Updated selector to match the new class names (removed 'src-' part)
        const allCards = document.querySelectorAll('.ant-card.antd-pro-pages-elms-device-signal-index-chart');
        allCards.forEach(patchSignalCard);
    }

    /**********************************************************
     * G) MutationObserver with Disconnect/Reconnect
     **********************************************************/
    let observer = null;

    function handleMutations() {
        observer.disconnect();   // avoid infinite loops
        patchAllSignalCards();   // do our modifications
        observer.observe(document.body, { childList: true, subtree: true });
    }

    observer = new MutationObserver(() => {
        // Debounce to handle rapid changes
        clearTimeout(handleMutations._timer);
        handleMutations._timer = setTimeout(handleMutations, 50);
    });

    // Start observing
    observer.observe(document.body, { childList: true, subtree: true });
    // Initial run
    handleMutations();

})();
