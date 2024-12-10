// ==UserScript==
// @name         InHand Device - Copy MAC Address
// @version      0.3
// @description  Copy MAC Address to clipboard
// @match        https://*.iot.inhandnetworks.com/status-devices.jsp
// @grant        GM_addStyle
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/inhand/inhand-tunnel-status.js
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/inhand/inhand-tunnel-status.js
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(' .copyButton { margin-left: 10px; padding: 5px; } ');
    GM_addStyle(' .copyButton:before { content: "\uD83D\uDCCB"; } '); // clipboard icon

    // Function to modify MAC addresses
    function modifyMacAddresses() {
        // Modify the MAC addresses in the page
        const macAddresses = document.querySelectorAll('a[href^="http://standards.ieee.org/cgi-bin/ouisearch?"]');
        macAddresses.forEach(macAddress => {
            if (!macAddress.nextElementSibling || !macAddress.nextElementSibling.classList.contains('copyButton')) {
                const macText = macAddress.textContent;
                const copyButton = document.createElement('button');
                copyButton.className = 'copyButton';
                copyButton.title = 'Copy to clipboard';
                copyButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    copyToClipboard(macText);
                });
                macAddress.href = `https://maclookup.app/search/result?mac=${macText}`;
                macAddress.target = '_blank';
                macAddress.parentNode.appendChild(copyButton);
            }
        });
    }

    function copyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }

    modifyMacAddresses();

    // Observe changes to the DOM and reapply changes when new nodes are added
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
                modifyMacAddresses();
            }
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
