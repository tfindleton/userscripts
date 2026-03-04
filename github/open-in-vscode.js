// ==UserScript==
// @name         GitHub - Open with Visual Studio Code
// @version      0.0.5
// @description  Adds an "Open with Visual Studio Code" action to GitHub repo pages that clones the repo via the vscode:// protocol.
// @icon         https://github.com/favicon.ico
// @match        https://github.com/*/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/refs/heads/main/github/open-in-vscode.js
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/refs/heads/main/github/open-in-vscode.js
// ==/UserScript==

(function () {
  "use strict";

  /**
   * Returns "OWNER/REPO" using GitHub's own meta tag when available.
   * This is more robust than parsing the pathname alone.
   */
  function getRepoNwo() {
    // GitHub sets this meta on repo pages (and many subpages within a repo).
    const meta = document.querySelector('meta[name="octolytics-dimension-repository_nwo"]');
    if (meta && meta.content && meta.content.includes("/")) {
      return meta.content.trim();
    }

    // Fallback: read the og:url or current pathname — /OWNER/REPO/...
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1];
      // Filter out well-known non-repo top-level routes.
      const blockedOwners = new Set([
        "apps", "collections", "events", "explore", "features",
        "issues", "login", "logout", "marketplace", "notifications",
        "orgs", "pricing", "pulls", "search", "settings", "signup",
        "sponsors", "topics", "trending",
      ]);
      if (!blockedOwners.has(owner)) {
        return `${owner}/${repo}`;
      }
    }

    return null;
  }

  function buildSshCloneUrl(repoNwo) {
    // Canonical SSH URL. Git url.insteadOf rules can transparently rewrite this
    // to a per-account host alias (e.g. github.com-personal).
    return `git@github.com:${repoNwo}.git`;
  }

  function buildVsCodeUrl(sshCloneUrl) {
    // VS Code's built-in Git extension registers this protocol handler.
    // Navigating to it triggers the Clone flow with a folder picker.
    return `vscode://vscode.git/clone?url=${encodeURIComponent(sshCloneUrl)}`;
  }

  /**
   * Fire a vscode:// URL without navigating the current page away.
   * Using a hidden anchor + click is more reliable than window.location.href
   * for custom protocol handlers across browsers.
   */
  function openProtocolUrl(url) {
    const a = document.createElement("a");
    a.href = url;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    // Clean up after a tick so the click has time to register.
    setTimeout(() => a.remove(), 500);
  }

  function onVsCodeActionClick(event) {
    event.preventDefault();
    const target = event.currentTarget;
    if (!(target instanceof Element)) {
      return;
    }

    const vscodeUrl = target.getAttribute("data-tf-vscode-url");
    if (!vscodeUrl) {
      return;
    }

    openProtocolUrl(vscodeUrl);
  }

  function getActionItemLabel(item) {
    const label = item.querySelector('span[class*="ItemLabel"]');
    return (label?.textContent ?? item.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  function findListItemByLabel(list, expectedLabel) {
    return (
      Array.from(list.querySelectorAll(":scope > li")).find(
        (item) => getActionItemLabel(item) === expectedLabel
      ) ?? null
    );
  }

  function isCodeActionList(list) {
    const labels = Array.from(list.querySelectorAll(":scope > li")).map(getActionItemLabel);
    return labels.includes("Download ZIP") && labels.some((label) => label.startsWith("Open with "));
  }

  function findCodeActionLists() {
    const scopedLists = document.querySelectorAll(
      ".react-overview-code-button-action-list ul, [class*='react-overview-code-button-action-list'] ul"
    );
    const scopedMatches = Array.from(scopedLists).filter(isCodeActionList);
    if (scopedMatches.length > 0) {
      return scopedMatches;
    }

    // Fallback in case GitHub changes wrapper class names again.
    return Array.from(document.querySelectorAll("ul")).filter(isCodeActionList);
  }

  function sanitizeClonedItem(item) {
    item.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
    item.querySelectorAll("[aria-labelledby]").forEach((el) => el.removeAttribute("aria-labelledby"));
    item.querySelectorAll("[aria-describedby]").forEach((el) => el.removeAttribute("aria-describedby"));
  }

  function normalizeInteractiveElement(item) {
    let interactive = item.querySelector("button, a");
    if (!interactive) {
      return null;
    }

    if (interactive.tagName === "A") {
      const button = document.createElement("button");
      button.className = interactive.className;
      button.type = "button";
      for (const name of interactive.getAttributeNames()) {
        if (name === "class" || name === "href" || name === "id" || name === "aria-labelledby") {
          continue;
        }
        const value = interactive.getAttribute(name);
        if (value !== null) {
          button.setAttribute(name, value);
        }
      }
      while (interactive.firstChild) {
        button.appendChild(interactive.firstChild);
      }
      interactive.replaceWith(button);
      interactive = button;
    }

    return interactive;
  }

  let vsCodeIconInstance = 0;
  function createVsCodeIconElement() {
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    const id = String(++vsCodeIconInstance);
    const maskId = `tf-vscode-mask-${id}`;
    const filter0Id = `tf-vscode-filter0-${id}`;
    const filter1Id = `tf-vscode-filter1-${id}`;
    const gradientId = `tf-vscode-gradient-${id}`;

    svg.setAttribute("class", "octicon");
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("fill", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "display:inline-block;vertical-align:text-bottom;pointer-events:none;";

    svg.innerHTML = `
      <mask id="${maskId}" mask-type="alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M70.9119 99.3171C72.4869 99.9307 74.2828 99.8914 75.8725 99.1264L96.4608 89.2197C98.6242 88.1787 100 85.9892 100 83.5872V16.4133C100 14.0113 98.6243 11.8218 96.4609 10.7808L75.8725 0.873756C73.7862 -0.130129 71.3446 0.11576 69.5135 1.44695C69.252 1.63711 69.0028 1.84943 68.769 2.08341L29.3551 38.0415L12.1872 25.0096C10.589 23.7965 8.35363 23.8959 6.86933 25.2461L1.36303 30.2549C-0.452552 31.9064 -0.454633 34.7627 1.35853 36.417L16.2471 50.0001L1.35853 63.5832C-0.454633 65.2374 -0.452552 68.0938 1.36303 69.7453L6.86933 74.7541C8.35363 76.1043 10.589 76.2037 12.1872 74.9905L29.3551 61.9587L68.769 97.9167C69.3925 98.5406 70.1246 99.0104 70.9119 99.3171ZM75.0152 27.2989L45.1091 50.0001L75.0152 72.7012V27.2989Z" fill="white" />
      </mask>
      <g mask="url(#${maskId})">
        <path d="M96.4614 10.7962L75.8569 0.875542C73.4719 -0.272773 70.6217 0.211611 68.75 2.08333L1.29858 63.5832C-0.515693 65.2373 -0.513607 68.0937 1.30308 69.7452L6.81272 74.754C8.29793 76.1042 10.5347 76.2036 12.1338 74.9905L93.3609 13.3699C96.086 11.3026 100 13.2462 100 16.6667V16.4275C100 14.0265 98.6246 11.8378 96.4614 10.7962Z" fill="#0065A9" />
        <g filter="url(#${filter0Id})">
          <path d="M96.4614 89.2038L75.8569 99.1245C73.4719 100.273 70.6217 99.7884 68.75 97.9167L1.29858 36.4169C-0.515693 34.7627 -0.513607 31.9063 1.30308 30.2548L6.81272 25.246C8.29793 23.8958 10.5347 23.7964 12.1338 25.0095L93.3609 86.6301C96.086 88.6974 100 86.7538 100 83.3334V83.5726C100 85.9735 98.6246 88.1622 96.4614 89.2038Z" fill="#007ACC" />
        </g>
        <g filter="url(#${filter1Id})">
          <path d="M75.8578 99.1263C73.4721 100.274 70.6219 99.7885 68.75 97.9166C71.0564 100.223 75 98.5895 75 95.3278V4.67213C75 1.41039 71.0564 -0.223106 68.75 2.08329C70.6219 0.211402 73.4721 -0.273666 75.8578 0.873633L96.4587 10.7807C98.6234 11.8217 100 14.0112 100 16.4132V83.5871C100 85.9891 98.6234 88.1786 96.4586 89.2196L75.8578 99.1263Z" fill="#1F9CF0" />
        </g>
        <g style="mix-blend-mode:overlay" opacity="0.25">
          <path fill-rule="evenodd" clip-rule="evenodd" d="M70.8511 99.3171C72.4261 99.9306 74.2221 99.8913 75.8117 99.1264L96.4 89.2197C98.5634 88.1787 99.9392 85.9892 99.9392 83.5871V16.4133C99.9392 14.0112 98.5635 11.8217 96.4001 10.7807L75.8117 0.873695C73.7255 -0.13019 71.2838 0.115699 69.4527 1.44688C69.1912 1.63705 68.942 1.84937 68.7082 2.08335L29.2943 38.0414L12.1264 25.0096C10.5283 23.7964 8.29285 23.8959 6.80855 25.246L1.30225 30.2548C-0.513334 31.9064 -0.515415 34.7627 1.29775 36.4169L16.1863 50L1.29775 63.5832C-0.515415 65.2374 -0.513334 68.0937 1.30225 69.7452L6.80855 74.754C8.29285 76.1042 10.5283 76.2036 12.1264 74.9905L29.2943 61.9586L68.7082 97.9167C69.3317 98.5405 70.0638 99.0104 70.8511 99.3171ZM74.9544 27.2989L45.0483 50L74.9544 72.7012V27.2989Z" fill="url(#${gradientId})" />
        </g>
      </g>
      <defs>
        <filter id="${filter0Id}" x="-8.39411" y="15.8291" width="116.727" height="92.2456" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
          <feOffset />
          <feGaussianBlur stdDeviation="4.16667" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend mode="overlay" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <filter id="${filter1Id}" x="60.4167" y="-8.07558" width="47.9167" height="116.151" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" />
          <feOffset />
          <feGaussianBlur stdDeviation="4.16667" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
          <feBlend mode="overlay" in2="BackgroundImageFix" result="effect1_dropShadow" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
        </filter>
        <linearGradient id="${gradientId}" x1="49.9392" y1="0.257812" x2="49.9392" y2="99.7423" gradientUnits="userSpaceOnUse">
          <stop stop-color="white" />
          <stop offset="1" stop-color="white" stop-opacity="0" />
        </linearGradient>
      </defs>
    `;

    return svg;
  }

  function setVsCodeLeadingVisual(item, list) {
    // Replace whatever icon the template had with an inline VS Code SVG.
    // If the template item had no LeadingVisual slot (e.g. "Open with Visual Studio"),
    // create one by copying the class names from the GitHub Desktop item which does have one.
    let leadingVisual = item.querySelector('[class*="LeadingVisual"]');
    if (!leadingVisual) {
      const desktopItem = findListItemByLabel(list, "Open with GitHub Desktop");
      const referenceVisual = desktopItem?.querySelector('[class*="LeadingVisual"]');
      if (referenceVisual) {
        leadingVisual = document.createElement("span");
        leadingVisual.className = referenceVisual.className;
        const spacer = item.querySelector('[class*="Spacer"]');
        if (spacer) {
          spacer.insertAdjacentElement("afterend", leadingVisual);
        } else {
          item.querySelector('[class*="ActionListContent"]')?.prepend(leadingVisual);
        }
      }
    }

    if (leadingVisual) {
      leadingVisual.innerHTML = "";
      leadingVisual.appendChild(createVsCodeIconElement());
    }
  }

  function updateVsCodeActionItem(item, list, vscodeUrl, sshUrl) {
    sanitizeClonedItem(item);
    setVsCodeLeadingVisual(item, list);

    const interactive = normalizeInteractiveElement(item);
    if (!interactive) {
      return false;
    }

    // Reset any previously attached listeners to avoid stale repo URLs on navigation.
    const freshInteractive = interactive.cloneNode(true);
    interactive.replaceWith(freshInteractive);

    freshInteractive.setAttribute("type", "button");
    freshInteractive.removeAttribute("href");
    freshInteractive.setAttribute("data-tf-open-vscode-trigger", "1");
    freshInteractive.setAttribute("data-tf-vscode-url", vscodeUrl);
    freshInteractive.title = `Clone in Visual Studio Code\n${sshUrl}`;
    freshInteractive.addEventListener("click", onVsCodeActionClick);

    const label = item.querySelector('span[class*="ItemLabel"]');
    if (label) {
      label.textContent = "Open with Visual Studio Code";
    } else {
      freshInteractive.textContent = "Open with Visual Studio Code";
    }

    return true;
  }

  function createVsCodeActionItem(list, vscodeUrl, sshUrl) {
    const templateItem =
      findListItemByLabel(list, "Open with Visual Studio") ||
      findListItemByLabel(list, "Open with GitHub Desktop");
    if (!templateItem) {
      return null;
    }

    const item = templateItem.cloneNode(true);
    item.setAttribute("data-tf-open-vscode", "1");

    if (!updateVsCodeActionItem(item, list, vscodeUrl, sshUrl)) {
      return null;
    }

    return item;
  }

  function injectButton() {
    const repoNwo = getRepoNwo();
    if (!repoNwo) {
      return false;
    }

    const sshUrl = buildSshCloneUrl(repoNwo);
    const vscodeUrl = buildVsCodeUrl(sshUrl);
    let changed = false;

    for (const list of findCodeActionLists()) {
      const existing = list.querySelector('[data-tf-open-vscode="1"]');
      if (existing) {
        updateVsCodeActionItem(existing, list, vscodeUrl, sshUrl);
        continue;
      }

      const item = createVsCodeActionItem(list, vscodeUrl, sshUrl);
      if (!item) {
        continue;
      }

      const downloadZipItem = findListItemByLabel(list, "Download ZIP");
      if (downloadZipItem) {
        list.insertBefore(item, downloadZipItem);
      } else {
        list.appendChild(item);
      }
      changed = true;
    }

    return changed;
  }

  function isLikelyCodeTrigger(event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return false;
    }

    const trigger = target.closest("button, summary, a, [role='button']");
    if (!trigger) {
      return false;
    }

    if (
      trigger.matches(
        'button[data-testid="code-button"], summary[data-testid="code-button"], button[aria-label="Code"], summary[aria-label="Code"], [aria-label="Code"], get-repo summary'
      )
    ) {
      return true;
    }

    const ariaLabel = (trigger.getAttribute("aria-label") ?? "").trim();
    if (ariaLabel === "Code") {
      return true;
    }

    const text = (trigger.textContent ?? "").replace(/\s+/g, " ").trim();
    return text === "Code";
  }

  function start() {
    let scheduled = false;
    let openObserver = null;
    let openObserverTimer = null;

    const scheduleInject = () => {
      if (scheduled) {
        return;
      }
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        injectButton();
      });
    };

    const stopOpenObserver = () => {
      if (openObserver) {
        openObserver.disconnect();
        openObserver = null;
      }
      if (openObserverTimer !== null) {
        clearTimeout(openObserverTimer);
        openObserverTimer = null;
      }
    };

    const startOpenObserver = (durationMs = 1600) => {
      stopOpenObserver();

      openObserver = new MutationObserver(scheduleInject);
      openObserver.observe(document.documentElement, { childList: true, subtree: true });
      openObserverTimer = window.setTimeout(stopOpenObserver, durationMs);
    };

    const scheduleOpenBurst = () => {
      scheduleInject();
      startOpenObserver();
      const delays = [50, 150, 350, 700, 1200];
      for (const delay of delays) {
        setTimeout(scheduleInject, delay);
      }
    };

    scheduleInject();

    // When GitHub toggles existing popovers without adding nodes, run once after click.
    document.addEventListener(
      "click",
      (event) => {
        if (isLikelyCodeTrigger(event)) {
          scheduleOpenBurst();
        }
      },
      true
    );

    document.addEventListener("turbo:render", scheduleOpenBurst);
  }

  start();
})();
