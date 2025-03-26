// ==UserScript==
// @name         Panorama 11 - Highlight & Copy by Header (Multi-table version)
// @version      2.3.1
// @description  Only style/copy on summary page. Finds columns by header text "Device Name"/"Serial Number", even if multiple <table> in the header.
// @icon         https://panorama.example.com/favicon.ico
// @match        https://panorama.example.com/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';

  let observer = null;
  window.addEventListener('hashchange', onLocationChange);
  onLocationChange(); // run once at initial load

  function onLocationChange() {
    // Only activate on EXACT summary page:
    if (window.location.hash === '#panorama::Standard::panorama/managed-devices/summary') {
      createObserver();
    } else {
      removeObserver();
    }
  }

  function createObserver() {
    if (observer) return; // already active

    observer = new MutationObserver(() => {
      processPage();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    processPage();
  }

  function removeObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  function processPage() {
    // Find all .x-grid3 elements
    const gridTables = document.querySelectorAll('.x-grid3');
    gridTables.forEach(grid => {
      // Which columns get copy logic?
      const colIndexes = findInterestingColumns(grid, [
        'Device Name',
        'Serial Number',
        'Software Version',
      ]);
      if (colIndexes.size === 0) {
        // console.debug("No interesting columns found for this grid:", grid);
      }

      // Style data rows
      const body = grid.querySelector('.x-grid3-body');
      if (!body) return;

      // Each "row" is a <div class="x-grid3-row ...">
      const rows = body.querySelectorAll('.x-grid3-row');
      rows.forEach(rowDiv => {
        const tds = rowDiv.querySelectorAll('td.x-grid3-cell');
        tds.forEach((td, tdIndex) => {
          const innerDiv = td.querySelector('div.x-grid3-cell-inner');
          if (!innerDiv) return;

          // 1) Always highlight "Connected"/"Disconnected"
          highlightStatus(innerDiv);

          // 2) If this column is in our set, apply copy logic
          if (colIndexes.has(tdIndex)) {
            addCopyBehavior(innerDiv);
          }
        });
      });
    });
  }

  /**
   * We scan every tr.x-grid3-hd-row in the .x-grid3-header.
   * For each row, we see if it contains text matching any of our headerKeywords.
   * The first row that includes at least one match is considered our "real" header row.
   */
  function findInterestingColumns(gridElement, headerKeywords) {
    const colIndexes = new Set();
    const headerRows = gridElement.querySelectorAll('.x-grid3-header table thead tr.x-grid3-hd-row');
    if (!headerRows.length) return colIndexes;

    let chosenRow = null;
    for (const row of headerRows) {
      const tds = row.querySelectorAll('td');
      let matchedSomething = false;

      for (const td of tds) {
        const text = td.textContent.trim();
        for (const keyword of headerKeywords) {
          if (text.includes(keyword)) {
            matchedSomething = true;
            break;
          }
        }
        if (matchedSomething) break;
      }
      if (matchedSomething) {
        chosenRow = row;
        break;
      }
    }

    if (!chosenRow) {
      // No row had any keywords
      return colIndexes;
    }

    // parse out the indexes
    const chosenTds = chosenRow.querySelectorAll('td');
    chosenTds.forEach((td, index) => {
      const cellText = td.textContent.trim();
      for (const keyword of headerKeywords) {
        if (cellText.includes(keyword)) {
          colIndexes.add(index);
          break;
        }
      }
    });
    return colIndexes;
  }

  // 1) Always highlight "Connected"/"Disconnected" in any cell text
  function highlightStatus(cellDiv) {
    const text = cellDiv.textContent.trim();
    if (text === 'Disconnected') {
      cellDiv.style.color = '#D94949';
      cellDiv.style.fontWeight = 'bold';
    } else if (text === 'Connected') {
      cellDiv.style.color = '#1FAF2C';
      cellDiv.style.fontWeight = 'bold';
    }
  }

  // 2) If column is in our set, make the cell text copyable
  function addCopyBehavior(cellDiv) {
    if (cellDiv.dataset.hasCopy === 'true') return;
    cellDiv.dataset.hasCopy = 'true';

    const text = cellDiv.textContent.trim();
    if (!text) return;

    cellDiv.style.cursor = 'pointer';
    cellDiv.addEventListener('click', () => {
      navigator.clipboard.writeText(text).then(() => {
        showCopiedFeedback(cellDiv, text);
      });
    });
  }

  function showCopiedFeedback(el, originalText) {
    el.textContent = 'Copied!';
    setTimeout(() => {
      el.textContent = originalText;
    }, 1000);
  }

})();