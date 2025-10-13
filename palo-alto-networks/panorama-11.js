// ==UserScript==
// @name         Panorama 11 - Highlight & Copy by Header (Multi-table version)
// @version      2.3.3
// @description  Only style/copy on summary page. Finds columns by header text "Device Name"/"Serial Number", even if multiple <table> in the header.
// @icon         https://pan.svpn.services/favicon.ico
// @match        https://pan.svpn.services/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/refs/heads/main/palo-alto-networks/panorama-11.js
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/refs/heads/main/palo-alto-networks/panorama-11.js
// ==/UserScript==

(function () {
  'use strict';

  const DEBUG = false; // Set to false in production to suppress debug logs.

  // We only want to run on known Panorama managed-device summary routes.
  const RELEVANT_HASH_FRAGMENTS = [
    'panorama/managed-devices/summary',
    'panorama::standard',
    'panorama::',
  ];

  const HEADER_KEYWORDS = [
    'Device Name',
    'Serial Number',
    'Software Version',
  ];

  function getNormalizedHash() {
    const rawHash = window.location.hash || '';
    try {
      return decodeURIComponent(rawHash).toLowerCase();
    } catch (err) {
      if (DEBUG) {
        console.warn('[DEBUG] Failed to decode hash, using raw value:', rawHash, err);
      }
      return rawHash.toLowerCase();
    }
  }

  function isRelevantPage() {
    const currentHash = getNormalizedHash();
    if (
      currentHash &&
      RELEVANT_HASH_FRAGMENTS.some((fragment) => currentHash.includes(fragment))
    ) {
      return true;
    }

    // Fallback: if the grid header exists we are on a managed devices table even if the hash is missing yet.
    return document.querySelector('.x-grid3-header') !== null;
  }

  // We'll store a map of: gridElement -> Set of interesting column indexes
  // so we only have to re-scan the header each time a new .x-grid3 is inserted/changed
  const gridColIndexesMap = new WeakMap();

  // The observer that will watch newly added nodes
  let observer = null;

  // Start by checking current page and then watch hash changes
  window.addEventListener('hashchange', onHashChange);
  onHashChange(); // run once on initial load

  function onHashChange() {
    if (DEBUG) {
      console.log('[DEBUG] Hash changed:', window.location.hash);
    }
    if (isRelevantPage()) {
      if (!observer) {
        if (DEBUG) {
          console.log('[DEBUG] Setting up MutationObserver on relevant page.');
        }
        startObserving();
      }
      if (document.body) {
        // In case some elements are already present (page loaded with the correct hash),
        // handle them right away:
        processExistingElements(document.body);
      }
    } else {
      if (observer) {
        if (DEBUG) {
          console.log('[DEBUG] Not a relevant page. Disconnecting observer.');
        }
        observer.disconnect();
        observer = null;
      }
    }
  }

  function startObserving() {
    if (observer) {
      return;
    }

    if (!document.body) {
      if (DEBUG) {
        console.log('[DEBUG] document.body not ready. Waiting for DOMContentLoaded.');
      }
      document.addEventListener('DOMContentLoaded', startObserving, { once: true });
      return;
    }

    observer = new MutationObserver(mutationCallback);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Called whenever new nodes are added to the DOM.
   */
  function mutationCallback(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            processExistingElements(node);
          }
        }
      }
    }
  }

  /**
   * processExistingElements:
   *  - Finds any .x-grid3-header, .x-grid3-row, or .x-grid3-cell in the subtree
   *    of 'root'. We either recalc columns if a new header was found or
   *    highlight/copy for newly added rows/cells.
   */
  function processExistingElements(root) {
    // If we're not on the relevant page, skip
    if (!isRelevantPage()) {
      return;
    }

    // 1) If there's a .x-grid3-header, recalc columns for its grid
    const headerElems = root.querySelectorAll
      ? root.querySelectorAll('.x-grid3-header')
      : [];
    for (const headerEl of headerElems) {
      const grid = headerEl.closest('.x-grid3');
      if (grid) {
        if (DEBUG) {
          console.log('[DEBUG] Found new/updated .x-grid3-header in grid', grid);
        }
        // Recalc columns for this grid
        const colIndexes = findInterestingColumns(grid, HEADER_KEYWORDS);
        gridColIndexesMap.set(grid, colIndexes);
        if (DEBUG) {
          console.log('[DEBUG] Set colIndexes for grid:', Array.from(colIndexes));
        }
      }
    }

    // 2) For any newly added .x-grid3-row, highlight/copy relevant columns
    const rowElems = root.querySelectorAll
      ? root.querySelectorAll('.x-grid3-row')
      : [];
    for (const rowEl of rowElems) {
      processRow(rowEl);
    }

    // 3) It's also possible that an element might contain just a single cell
    //    or some piece of row. So check .x-grid3-cell directly, in case a partial row is added.
    //    (This might be uncommon, but let's be safe.)
    const cellElems = root.querySelectorAll
      ? root.querySelectorAll('.x-grid3-cell')
      : [];
    for (const cellEl of cellElems) {
      processCell(cellEl);
    }
  }

  /**
   * processRow:
   *  - For a newly added row, find which grid it belongs to and apply highlight/copy logic
   *    to any "interesting" columns.
   */
  function processRow(rowEl) {
    const grid = rowEl.closest('.x-grid3');
    if (!grid) {
      return; // not sure what this row belongs to
    }
    let colIndexes = gridColIndexesMap.get(grid);
    if (!colIndexes) {
      // We may not have processed this grid's header yet. Let's try:
      colIndexes = findInterestingColumns(grid, HEADER_KEYWORDS);
      gridColIndexesMap.set(grid, colIndexes);
      if (DEBUG) {
        console.log('[DEBUG] Late colIndexes init for grid:', Array.from(colIndexes));
      }
    }

    const cells = rowEl.querySelectorAll('td.x-grid3-cell');
    // In older code, we used an index-based approach. We'll replicate that here:
    cells.forEach((cell, index) => {
      const innerDiv = cell.querySelector('div.x-grid3-cell-inner');
      if (!innerDiv) return;
      // 1) Always highlight "Connected"/"Disconnected"
      highlightStatus(innerDiv);

      // 2) If this column is interesting, add copy logic
      if (colIndexes.has(index)) {
        addCopyBehavior(innerDiv);
      }
    });
  }

  /**
   * processCell:
   *  - If a cell is added outside the usual row structure, we still handle it
   *    by determining its index in the row and applying highlight/copy if needed.
   */
  function processCell(cellEl) {
    // We need the row to find the grid & col index
    const row = cellEl.closest('.x-grid3-row');
    if (!row) return;
    const grid = row.closest('.x-grid3');
    if (!grid) return;

    let colIndexes = gridColIndexesMap.get(grid);
    if (!colIndexes) {
      colIndexes = findInterestingColumns(grid, HEADER_KEYWORDS);
      gridColIndexesMap.set(grid, colIndexes);
      if (DEBUG) {
        console.log('[DEBUG] Late colIndexes init via processCell:', Array.from(colIndexes));
      }
    }

    // Find all cells in the row, to figure out the index of cellEl
    const allCells = Array.from(row.querySelectorAll('td.x-grid3-cell'));
    const index = allCells.indexOf(cellEl);
    if (index === -1) {
      // Not found, weird partial DOM scenario
      return;
    }

    const innerDiv = cellEl.querySelector('div.x-grid3-cell-inner');
    if (!innerDiv) return;

    // highlight
    highlightStatus(innerDiv);

    // if column is interesting, add copy logic
    if (colIndexes.has(index)) {
      addCopyBehavior(innerDiv);
    }
  }

  /**
   * findInterestingColumns:
   *   - Looks for a .x-grid3-header in the given grid,
   *     scans each header row for keywords (e.g. "Device Name", etc.).
   *   - Returns a Set of the column indexes that match any of the keywords.
   */
  function findInterestingColumns(gridElement, headerKeywords) {
    const colIndexes = new Set();
    const headerRows = gridElement.querySelectorAll(
      '.x-grid3-header table thead tr.x-grid3-hd-row, .x-grid3-header table tr.x-grid3-hd-row'
    );
    if (!headerRows.length) {
      if (DEBUG) {
        console.log('[DEBUG] No header rows found in grid.');
      }
      return colIndexes;
    }

    let chosenRow = null;
    let maxMatches = 0;
    headerRows.forEach((row) => {
      const tds = row.querySelectorAll('td');
      let matchCount = 0;
      tds.forEach((td) => {
        const text = td.textContent.trim();
        for (const keyword of headerKeywords) {
          if (text.includes(keyword)) {
            matchCount++;
            break;
          }
        }
      });
      if (matchCount > maxMatches) {
        maxMatches = matchCount;
        chosenRow = row;
      }
    });

    if (!chosenRow) {
      if (DEBUG) {
        console.log('[DEBUG] No header row matched any keywords.');
      }
      return colIndexes;
    }

    const chosenTds = chosenRow.querySelectorAll('td');
    chosenTds.forEach((td, i) => {
      const cellText = td.textContent.trim();
      for (const keyword of headerKeywords) {
        if (cellText.includes(keyword)) {
          colIndexes.add(i);
          break;
        }
      }
    });

    return colIndexes;
  }

  /**
   * highlightStatus:
   *   - Changes font color/weight if text is "Connected" or "Disconnected".
   */
  function highlightStatus(cellDiv) {
    const text = cellDiv.textContent.trim();
    if (DEBUG) {
      console.log('[DEBUG] Checking status for cell text:', text);
    }
    cellDiv.style.color = '';
    cellDiv.style.fontWeight = '';
    if (text === 'Disconnected') {
      cellDiv.style.color = '#D94949';
      cellDiv.style.fontWeight = 'bold';
    } else if (text === 'Connected') {
      cellDiv.style.color = '#1FAF2C';
      cellDiv.style.fontWeight = 'bold';
    }
  }

  /**
   * addCopyBehavior:
   *   - Allows clicking on a cell to copy its text to the clipboard.
   */
  function addCopyBehavior(cellDiv) {
    const currentText = cellDiv.textContent.trim();
    if (cellDiv.dataset.hasCopy === 'true') {
      if (DEBUG) {
        console.log('[DEBUG] Copy behavior already added to this cell:', cellDiv);
      }
      cellDiv.dataset.originalText = currentText;
      return;
    }
    cellDiv.dataset.hasCopy = 'true';
    cellDiv.dataset.originalText = currentText;

    cellDiv.style.cursor = 'pointer';
    cellDiv.addEventListener('click', () => {
      if (DEBUG) {
        console.log('[DEBUG] Cell clicked. Copying text:', cellDiv.dataset.originalText);
      }
      const textToCopy = cellDiv.dataset.originalText;
      if (!textToCopy) return;
      navigator.clipboard.writeText(textToCopy).then(() => {
        showCopiedFeedback(cellDiv, textToCopy);
      }).catch(err => {
        if (DEBUG) {
          console.error('[DEBUG] Error copying text:', err);
        }
      });
    });
  }

  /**
   * showCopiedFeedback:
   *   - Temporarily replaces cell text with "Copied!" and then restores it.
   */
  function showCopiedFeedback(el, originalText) {
    if (DEBUG) {
      console.log('[DEBUG] Showing copied feedback for text:', originalText);
    }
    el.textContent = 'Copied!';
    setTimeout(() => {
      el.textContent = originalText;
    }, 1000);
  }

})();
