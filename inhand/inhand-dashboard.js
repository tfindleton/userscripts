// ==UserScript==
// @name         InHand Dashboard - Copy Values to Clipboard
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adds a copy button next to IP, Phone, IMSI, IMEI, ICCID to copy to clipboard
// @author       Tyler Findleton
// @match        https://iot.inhandnetworks.com/device/profile/*/properties
// @grant        GM_addStyle
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(' .copyButton { margin-left: 10px; padding: 5px; } ');
    GM_addStyle(' .copyButton:before { content: "\uD83D\uDCCB"; } '); // clipboard icon

    // List of labels for which the copy button needs to be added
    var labels = ['IP', 'Phone', 'IMSI', 'IMEI', 'ICCID', 'Serial Number', 'Online Duration'];

    // Function to modify the page
    function modifyValues() {
        var elements = document.querySelectorAll('.ant-descriptions-item');
        elements.forEach(element => {
            var labelElement = element.querySelector('.ant-descriptions-item-label');
            var contentElement = element.querySelector('.ant-descriptions-item-content');

            if(labelElement && contentElement){
                var labelText = labelElement.textContent.replace(':', '').trim();
                var contentText = contentElement.textContent.trim();

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

    // Create a MutationObserver instance
    var observer = new MutationObserver(modifyValues);

    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true });

    // Run the modifyValues function once when the page is loaded
    modifyValues();

})();
