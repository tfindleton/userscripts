// ==UserScript==
// @name         InHand Dashboard - Copy Values to Clipboard
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Adds a copy button next to IP, Phone, IMSI, IMEI, ICCID to copy to clipboard
// @author       Tyler Findleton
// @match        https://iot.inhandnetworks.com/device/profile/*/properties
// @grant        GM_addStyle
// @grant        GM_setClipboard
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/inhand/inhand-dashboard.js
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/inhand/inhand-dashboard.js
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(' .copyButton { margin-left: 10px; padding: 5px; cursor: pointer; } ');
    GM_addStyle(' .copyButton:before { content: "\uD83D\uDCCB"; } '); // clipboard icon

    // List of labels for which the copy button needs to be added
    const labels = ['IP', 'Phone', 'IMSI', 'IMEI', 'ICCID', 'Serial Number', 'Online Duration'];

    // Function to modify the page
    function modifyValues() {
        const elements = document.querySelectorAll('.ant-descriptions-item');
        elements.forEach(element => {
            const labelElement = element.querySelector('.ant-descriptions-item-label');
            const contentElement = element.querySelector('.ant-descriptions-item-content');

            if(labelElement && contentElement){
                const labelText = labelElement.textContent.replace(':', '').trim();
                const contentText = contentElement.textContent.trim();

                if(labels.includes(labelText)){
                    // check if the button is already added
                    if (!contentElement.querySelector('.copyButton')) {
                        const copyButton = document.createElement('button');
                        copyButton.className = 'copyButton';
                        copyButton.title = 'Copy to clipboard';
                        copyButton.addEventListener('click', (event) => {
                            event.preventDefault();
                            GM_setClipboard(contentText); // using GM_setClipboard
                            //alert(labelText + ' copied to clipboard.');
                        });
                        contentElement.appendChild(copyButton);
                    }
                }
            }
        });
    }

    // Function to observe changes in the target element
    function observeChanges() {
        const observer = new MutationObserver(modifyValues);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Run the modifyValues function once when the page is loaded
    modifyValues();

    // Observe changes on the page
    observeChanges();

    // Add event listener for navigation changes
    window.addEventListener('load', () => {
        setTimeout(modifyValues, 1000); // delay to ensure all elements are loaded
    });

})();
