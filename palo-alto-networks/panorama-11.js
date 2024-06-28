// ==UserScript==
// @name     Panorama 11 - Highlight Connection Status
// @version  2.0
// @grant    none
// @match    https://panorama.svpn.services/*
// @description Style status based on connection status text
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/palo-alto-networks/panorama-11.js
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/palo-alto-networks/panorama-11.js
// ==/UserScript==

const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const divs = node.querySelectorAll('div[class*="x-grid3-cell-inner"]');
            styleDivs(divs);
          }
        });
      }
    });
  });
  
  function styleDivs(divs) {
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
  
  // Initial styling for any matching elements already in the DOM
  document.querySelectorAll('div[class*="x-grid3-cell-inner"]').forEach(div => {
    if (div.textContent.trim() === 'Disconnected' || div.textContent.trim() === 'Connected') {
      styleDivs([div]);
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });