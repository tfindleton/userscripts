// ==UserScript==
// @name     Panorama 10 - Highlight Connection Status
// @version  1.2.1
// @description Style status based on connection status text
// @match    https://example.com/*
// @grant    none
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/palo-alto-networks/panorama-10.js
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/palo-alto-networks/panorama-10.js
// ==/UserScript==

const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) { // To ensure that the node is an element
          const divs = node.querySelectorAll('.x-grid3-cell-inner.x-grid3-col-16');
          divs.forEach(div => {
            if (div.textContent.trim() === 'Disconnected') {
              div.style.color = '#D94949'; // Red
              div.style.fontWeight = 'bold';
            } else if (div.textContent.trim() === 'Connected') {
              div.style.color = '#1FAF2C'; // Green
              div.style.fontWeight = 'bold';
            }
          });
        }
      });
    }
  });
});

observer.observe(document.body, { childList: true, subtree: true });
