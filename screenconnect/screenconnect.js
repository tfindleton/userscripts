// ==UserScript==
// @name         ScreenConnect - Enhancer
// @version      0.0.1
// @description  Increases the height of ScopeBox and ScopedPermissionPanel in the Edit Role dialog. ScreenConnect URL is stored locally and never shared publicly.
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/refs/heads/main/screenconnect/screenconnect.js
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/refs/heads/main/screenconnect/screenconnect.js
// ==/UserScript==

(function () {
  'use strict';

  // ── URL Configuration ──────────────────────────────────────────────────────
  // The ScreenConnect host is stored locally in Tampermonkey storage so it is
  // never included in the public script source. You will be prompted on first run.
  // Use the Tampermonkey menu entry to change it at any time.
  let storedHost = GM_getValue('screenconnectHost', null);

  function promptForHost() {
    const input = prompt(
      'ScreenConnect — Configure URL\nEnter your ScreenConnect hostname (e.g. connect.example.com):',
      storedHost || ''
    );
    if (input && input.trim()) {
      // Strip any accidental scheme or path, store only the hostname.
      storedHost = input.trim().replace(/^https?:\/\//, '').split('/')[0];
      GM_setValue('screenconnectHost', storedHost);
      location.reload();
    }
  }

  GM_registerMenuCommand('Configure ScreenConnect URL…', promptForHost);

  if (!storedHost) {
    promptForHost();
    return;
  }

  if (window.location.hostname !== storedHost) {
    return; // Not the configured ScreenConnect instance — exit immediately.
  }
  // ───────────────────────────────────────────────────────────────────────────

  const style = document.createElement('style');
  style.textContent = `
    .DialogContainer .ModalDialog.EditRole .ScopedPermissionContainer .ScopeBox {
      height: 700px !important;
    }

    .DialogContainer .ModalDialog.EditRole .ScopedPermissionContainer > div.ScopedPermissionPanel {
      height: 700px !important;
    }

    .DialogContainer .ModalDialog.EditRole .ScopedPermissionContainer .DefinedOption > p:first-of-type {
      font-weight: bold;
      color: #8ab4f8;
    }
  `;
  document.head.appendChild(style);

})();
