// ==UserScript==
// @name         GitHub - Open with Visual Studio Code
// @version      0.0.4
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

  function createVsCodeIconElement() {
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("class", "octicon");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "display:inline-block;vertical-align:text-bottom;pointer-events:none;";

    const leftDark = document.createElementNS(svgNs, "path");
    leftDark.setAttribute("fill", "#0065A9");
    leftDark.setAttribute(
      "d",
      "M11.33.85a1 1 0 0 1 1.13-.06l2.77 1.84A1.6 1.6 0 0 1 16 3.96v8.08c0 .53-.26 1.03-.7 1.33l-2.77 1.84a1 1 0 0 1-1.13-.06L5.72 10.7 3.07 12.7a.67.67 0 0 1-.83-.02L.83 11.43a.67.67 0 0 1 .02-1L3.35 8 .85 5.57a.67.67 0 0 1-.02-1l1.41-1.25a.67.67 0 0 1 .83-.02L5.72 5.3 11.33.85Z"
    );

    const leftLight = document.createElementNS(svgNs, "path");
    leftLight.setAttribute("fill", "#007ACC");
    leftLight.setAttribute(
      "d",
      "M11.4 15.15a1 1 0 0 0 1.13.06l2.77-1.84c.44-.3.7-.8.7-1.33V3.96c0-.53-.26-1.03-.7-1.33L12.53.79a1 1 0 0 0-1.13.06L5.72 5.3l6.2 2.7-6.2 2.7 5.68 4.45Z"
    );

    const rightBar = document.createElementNS(svgNs, "path");
    rightBar.setAttribute("fill", "#1F9CF0");
    rightBar.setAttribute("d", "M12 3.02A.5.5 0 0 0 11.17 2.64L6.1 7.1a.5.5 0 0 0 0 .8l5.07 4.46A.5.5 0 0 0 12 11.98V3.02Z");

    svg.appendChild(leftDark);
    svg.appendChild(leftLight);
    svg.appendChild(rightBar);
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
