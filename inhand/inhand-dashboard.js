// ==UserScript==
// @name         InHand Dashboard - Copy Values to Clipboard
// @version      0.4
// @description  Adds a copy button next to IP, Phone, IMSI, IMEI, ICCID to copy to clipboard
// @match        https://iot.inhandnetworks.com/*
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/inhand/inhand-dashboard.js
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/inhand/inhand-dashboard.js
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle('.copyButton { margin-left: 10px; padding: 5px; cursor: pointer; }');
    GM_addStyle('.copyButton:before { content: "\uD83D\uDCCB"; }'); // clipboard icon

    const labels = ['IP', 'Phone', 'IMSI', 'IMEI', 'ICCID', 'Serial Number', 'Online Duration'];

    function modifyValues() {
        const elements = document.querySelectorAll('.ant-descriptions-item');
        if (elements.length === 0) return; // Exit if the target elements don't exist

        elements.forEach(element => {
            const labelElement = element.querySelector('.ant-descriptions-item-label');
            const contentElement = element.querySelector('.ant-descriptions-item-content');

            if (labelElement && contentElement) {
                const labelText = labelElement.textContent.replace(':', '').trim();
                const contentText = contentElement.textContent.trim();

                if (labels.includes(labelText)) {
                    if (!contentElement.querySelector('.copyButton')) {
                        const copyButton = document.createElement('button');
                        copyButton.className = 'copyButton';
                        copyButton.title = 'Copy to clipboard';
                        copyButton.addEventListener('click', (event) => {
                            event.preventDefault();
                            GM_setClipboard(contentText);
                        });
                        contentElement.appendChild(copyButton);
                    }
                }
            }
        });
    }

    function observeChanges() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    modifyValues();
                }
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    modifyValues();
    observeChanges();

})();
