// ==UserScript==
// @name         UniFi Dashboard Better Internet Health
// @namespace    https://unifi.ui.com/
// @version      0.3.3
// @description  Better internet health for the UniFi dashboard
// @match        https://unifi.ui.com/*
// @match        https://*.ui.com/*
// @grant        none
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/tfindleton/userscripts/main/unifi/ui-dashboard-better-internet-health.js
// @downloadURL  https://raw.githubusercontent.com/tfindleton/userscripts/main/unifi/ui-dashboard-better-internet-health.js
// ==/UserScript==

(function () {
    "use strict";

    const TILE_SELECTOR = ".tile-internet-health";

    const MODAL_ID = "uf-ihd-modal-overlay";
    const STYLE_ID = "uf-ihd-modal-style";
    const TOOLTIP_BOUNDARY_GAP = 0;
    const TOOLTIP_ARROW_GAP = 10;

    const OLD_MODAL_IDS = [
        "uf-health-modal-overlay",
        "uf-ihd-modal-overlay",
    ];

    const OLD_STYLE_IDS = [
        "uf-health-modal-style",
        "uf-ihd-modal-style",
    ];

    const COLOR_MAP = {
        healthy: {
            color: "rgb(55, 190, 95)",
            label: "Healthy",
            shortLabel: "Healthy",
            sort: 3,
        },
        disconnected: {
            color: "rgb(238, 99, 104)",
            label: "Internet Disconnected",
            shortLabel: "Disconnected",
            sort: 1,
        },
        latency: {
            color: "rgb(223, 193, 22)",
            label: "High Latency Detected",
            shortLabel: "Latency",
            sort: 2,
        },
        offline: {
            color: "rgb(66, 71, 77)",
            label: "Site Offline / No Data",
            shortLabel: "Offline",
            sort: 2,
        },
        unknown: {
            color: "rgb(128, 137, 149)",
            label: "Unknown",
            shortLabel: "Unknown",
            sort: 4,
        },
    };

    let selectedSegmentIndex = null;
    let activeTooltipSegmentIndex = null;
    let tooltipUpdateFrame = null;

    function removeOldUi() {
        OLD_MODAL_IDS.forEach((id) => {
            const element = document.getElementById(id);

            if (element) {
                element.remove();
            }
        });

        OLD_STYLE_IDS.forEach((id) => {
            const element = document.getElementById(id);

            if (element) {
                element.remove();
            }
        });

        document.body.style.overflow = "";
    }

    function installStyles() {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = `
            ${TILE_SELECTOR},
            ${TILE_SELECTOR} * {
                cursor: zoom-in !important;
            }

            ${TILE_SELECTOR} {
                border-radius: 6px;
                transition: outline-color 0.12s ease, filter 0.12s ease;
            }

            ${TILE_SELECTOR}:hover,
            ${TILE_SELECTOR}:focus-within {
                outline: 2px solid rgba(52, 139, 255, 0.55);
                outline-offset: 3px;
            }

            ${TILE_SELECTOR}:hover [class*="StackedBar-withTooltip"],
            ${TILE_SELECTOR}:focus-within [class*="StackedBar-withTooltip"] {
                filter: brightness(1.08);
            }

            #${MODAL_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                box-sizing: border-box;
                background: rgba(0, 0, 0, 0.58);
                color: rgb(235, 238, 242);
                font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }

            #${MODAL_ID}[hidden] {
                display: none !important;
            }

            .uf-ihd-card {
                width: min(1120px, calc(100vw - 48px));
                max-height: calc(100vh - 48px);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border-radius: 14px;
                background: rgb(20, 23, 29);
                border: 1px solid rgba(255, 255, 255, 0.12);
                box-shadow: 0 24px 90px rgba(0, 0, 0, 0.62);
            }

            .uf-ihd-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 18px;
                padding: 18px 20px;
                background: rgb(24, 28, 35);
                border-bottom: 1px solid rgba(255, 255, 255, 0.10);
            }

            .uf-ihd-title-wrap {
                min-width: 0;
            }

            .uf-ihd-title-line {
                display: flex;
                align-items: center;
                gap: 9px;
                min-width: 0;
            }

            .uf-ihd-site-dot {
                width: 8px;
                height: 8px;
                border-radius: 999px;
                background: rgb(55, 190, 95);
                flex: 0 0 auto;
            }

            .uf-ihd-title {
                margin: 0;
                color: rgb(245, 247, 250);
                font-size: 16px;
                font-weight: 700;
                line-height: 1.25;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .uf-ihd-subtitle {
                margin: 5px 0 0;
                color: rgb(145, 154, 166);
                font-size: 12px;
                line-height: 1.35;
            }

            .uf-ihd-close {
                width: 34px;
                height: 34px;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.14);
                background: rgb(35, 40, 49);
                color: rgb(245, 247, 250);
                cursor: pointer;
                font-size: 22px;
                line-height: 1;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex: 0 0 auto;
            }

            .uf-ihd-close:hover {
                background: rgb(47, 53, 64);
                border-color: rgba(255, 255, 255, 0.24);
            }

            .uf-ihd-body {
                overflow: auto;
                padding: 18px 20px 20px;
            }

            .uf-ihd-summary {
                display: grid;
                grid-template-columns: repeat(6, minmax(0, 1fr));
                gap: 10px;
                margin-bottom: 16px;
            }

            .uf-ihd-summary-card {
                min-width: 0;
                padding: 10px 11px;
                border-radius: 10px;
                background: rgb(29, 34, 43);
                border: 1px solid rgba(255, 255, 255, 0.09);
            }

            .uf-ihd-summary-label {
                margin: 0 0 5px;
                color: rgb(139, 148, 162);
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.04em;
                line-height: 1.2;
                text-transform: uppercase;
            }

            .uf-ihd-summary-value {
                margin: 0;
                color: rgb(238, 241, 245);
                font-size: 13px;
                font-weight: 650;
                line-height: 1.35;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .uf-ihd-chart-card {
                border-radius: 12px;
                padding: 18px;
                background: rgb(14, 17, 22);
                border: 1px solid rgba(255, 255, 255, 0.10);
            }

            .uf-ihd-chart-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 14px;
            }

            .uf-ihd-chart-title {
                margin: 0;
                color: rgb(238, 241, 245);
                font-size: 13px;
                font-weight: 700;
                line-height: 1.35;
            }

            .uf-ihd-chart-range {
                margin: 0;
                color: rgb(139, 148, 162);
                font-size: 12px;
                line-height: 1.35;
                white-space: nowrap;
            }

            .uf-ihd-bar-shell {
                position: relative;
                padding-top: 44px;
            }

            .uf-ihd-bar {
                display: flex;
                width: 100%;
                height: 40px;
                border-radius: 5px;
                background: rgb(38, 44, 54);
                overflow: visible;
            }

            .uf-ihd-segment {
                position: relative;
                min-width: 6px;
                height: 40px;
                border: 0;
                padding: 0;
                cursor: pointer;
                background: var(--uf-ihd-segment-color);
            }

            .uf-ihd-segment:first-child {
                border-top-left-radius: 5px;
                border-bottom-left-radius: 5px;
            }

            .uf-ihd-segment:last-child {
                border-top-right-radius: 5px;
                border-bottom-right-radius: 5px;
            }

            .uf-ihd-segment:hover,
            .uf-ihd-segment:focus-visible,
            .uf-ihd-segment[data-selected="true"] {
                filter: brightness(1.12);
                outline: 2px solid rgba(255, 255, 255, 0.72);
                outline-offset: 2px;
                z-index: 3;
            }

            .uf-ihd-segment-label {
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                max-width: calc(100% - 8px);
                color: rgba(255, 255, 255, 0.92);
                font-size: 11px;
                font-weight: 700;
                line-height: 1.1;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                pointer-events: none;
            }

            .uf-ihd-segment[data-small="true"] .uf-ihd-segment-label {
                display: none;
            }

            .uf-ihd-tooltip {
                position: fixed;
                left: var(--uf-ihd-tooltip-left, 50vw);
                top: var(--uf-ihd-tooltip-top, 0px);
                transform: translate(-50%, -100%);
                box-sizing: border-box;
                min-width: min(210px, calc(100vw - 72px));
                max-width: min(290px, calc(100vw - 72px));
                padding: 11px 12px 10px;
                display: none;
                border-radius: 6px;
                background: rgb(35, 38, 44);
                color: rgb(245, 247, 250);
                box-shadow: 0 14px 34px rgba(0, 0, 0, 0.42);
                border: 1px solid rgba(255, 255, 255, 0.08);
                pointer-events: none;
                z-index: 10;
            }

            .uf-ihd-tooltip::after {
                content: "";
                position: absolute;
                left: var(--uf-ihd-tooltip-arrow-left, 50%);
                top: 100%;
                transform: translateX(-50%);
                border-left: 7px solid transparent;
                border-right: 7px solid transparent;
                border-top: 7px solid rgb(35, 38, 44);
            }

            .uf-ihd-tooltip[data-visible="true"] {
                display: block;
            }

            .uf-ihd-tooltip-title {
                display: flex;
                align-items: center;
                gap: 7px;
                margin-bottom: 10px;
                font-size: 12px;
                font-weight: 750;
                line-height: 1.25;
                color: rgb(245, 247, 250);
                white-space: nowrap;
            }

            .uf-ihd-tooltip-dot {
                width: 6px;
                height: 6px;
                border-radius: 999px;
                background: var(--uf-ihd-segment-color);
                flex: 0 0 auto;
            }

            .uf-ihd-tooltip-times {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                gap: 14px;
                align-items: center;
                color: rgb(245, 247, 250);
                font-size: 12px;
                font-weight: 650;
                line-height: 1.25;
                white-space: nowrap;
            }

            .uf-ihd-tooltip-times span:nth-child(3) {
                text-align: right;
            }

            .uf-ihd-tooltip-duration {
                margin-top: 8px;
                color: rgb(151, 160, 174);
                font-size: 11px;
                line-height: 1.3;
            }

            .uf-ihd-axis {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 10px;
                margin-top: 8px;
                color: rgb(139, 148, 162);
                font-size: 11px;
                line-height: 1.35;
            }

            .uf-ihd-axis span:nth-child(1) {
                text-align: left;
            }

            .uf-ihd-axis span:nth-child(2) {
                text-align: center;
            }

            .uf-ihd-axis span:nth-child(3) {
                text-align: right;
            }

            .uf-ihd-legend {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 15px;
            }

            .uf-ihd-legend-item {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 5px 9px;
                border-radius: 999px;
                background: rgb(29, 34, 43);
                border: 1px solid rgba(255, 255, 255, 0.09);
                color: rgb(203, 210, 220);
                font-size: 12px;
                line-height: 1.25;
            }

            .uf-ihd-legend-dot {
                width: 8px;
                height: 8px;
                border-radius: 999px;
                flex: 0 0 auto;
            }

            .uf-ihd-lower-grid {
                display: grid;
                grid-template-columns: minmax(0, 1.5fr) minmax(300px, 0.9fr);
                gap: 14px;
                margin-top: 14px;
            }

            .uf-ihd-panel {
                border-radius: 12px;
                background: rgb(24, 28, 35);
                border: 1px solid rgba(255, 255, 255, 0.09);
                overflow: hidden;
            }

            .uf-ihd-panel-header {
                padding: 12px 14px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }

            .uf-ihd-panel-title {
                margin: 0;
                color: rgb(238, 241, 245);
                font-size: 13px;
                font-weight: 750;
                line-height: 1.35;
            }

            .uf-ihd-panel-subtitle {
                margin: 0;
                color: rgb(139, 148, 162);
                font-size: 11px;
                line-height: 1.35;
            }

            .uf-ihd-events {
                display: grid;
                gap: 0;
            }

            .uf-ihd-event-row {
                display: grid;
                grid-template-columns: minmax(160px, 1fr) minmax(170px, 1fr) minmax(74px, auto);
                gap: 12px;
                align-items: center;
                width: 100%;
                border: 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.07);
                padding: 11px 14px;
                background: transparent;
                color: inherit;
                text-align: left;
                cursor: pointer;
            }

            .uf-ihd-event-row:last-child {
                border-bottom: 0;
            }

            .uf-ihd-event-row:hover,
            .uf-ihd-event-row[data-selected="true"] {
                background: rgb(31, 36, 45);
            }

            .uf-ihd-event-status {
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
                color: rgb(235, 238, 242);
                font-size: 13px;
                font-weight: 700;
                line-height: 1.3;
            }

            .uf-ihd-event-dot {
                width: 7px;
                height: 7px;
                border-radius: 999px;
                background: var(--uf-ihd-segment-color);
                flex: 0 0 auto;
            }

            .uf-ihd-event-status-text {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .uf-ihd-event-time {
                color: rgb(205, 212, 222);
                font-size: 12px;
                font-weight: 650;
                line-height: 1.3;
                white-space: nowrap;
            }

            .uf-ihd-event-duration {
                color: rgb(139, 148, 162);
                font-size: 12px;
                line-height: 1.3;
                text-align: right;
                white-space: nowrap;
            }

            .uf-ihd-details {
                padding: 14px;
            }

            .uf-ihd-detail-empty {
                margin: 0;
                color: rgb(139, 148, 162);
                font-size: 12px;
                line-height: 1.45;
            }

            .uf-ihd-detail-status {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
                color: rgb(245, 247, 250);
                font-size: 14px;
                font-weight: 750;
                line-height: 1.35;
            }

            .uf-ihd-detail-dot {
                width: 8px;
                height: 8px;
                border-radius: 999px;
                background: var(--uf-ihd-segment-color);
                flex: 0 0 auto;
            }

            .uf-ihd-detail-list {
                display: grid;
                gap: 10px;
            }

            .uf-ihd-detail-item {
                display: grid;
                grid-template-columns: 94px 1fr;
                gap: 10px;
                align-items: baseline;
            }

            .uf-ihd-detail-key {
                color: rgb(139, 148, 162);
                font-size: 11px;
                font-weight: 700;
                line-height: 1.25;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }

            .uf-ihd-detail-value {
                color: rgb(226, 231, 238);
                font-size: 13px;
                font-weight: 650;
                line-height: 1.35;
                word-break: break-word;
            }

            @media (max-width: 900px) {
                .uf-ihd-summary {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }

                .uf-ihd-lower-grid {
                    grid-template-columns: 1fr;
                }
            }

            @media (max-width: 620px) {
                #${MODAL_ID} {
                    padding: 12px;
                }

                .uf-ihd-card {
                    width: calc(100vw - 24px);
                    max-height: calc(100vh - 24px);
                }

                .uf-ihd-summary {
                    grid-template-columns: 1fr;
                }

                .uf-ihd-event-row {
                    grid-template-columns: 1fr;
                    gap: 4px;
                }

                .uf-ihd-event-duration {
                    text-align: left;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function createModal() {
        let modal = document.getElementById(MODAL_ID);

        if (modal) {
            return modal;
        }

        modal = document.createElement("div");
        modal.id = MODAL_ID;
        modal.hidden = true;
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");

        modal.innerHTML = `
            <div class="uf-ihd-card" role="document">
                <div class="uf-ihd-header">
                    <div class="uf-ihd-title-wrap">
                        <div class="uf-ihd-title-line">
                            <span class="uf-ihd-site-dot"></span>
                            <h2 class="uf-ihd-title">Internet Health</h2>
                        </div>
                        <p class="uf-ihd-subtitle"></p>
                    </div>
                    <button class="uf-ihd-close" type="button" aria-label="Close Internet Health details">×</button>
                </div>
                <div class="uf-ihd-body">
                    <div class="uf-ihd-summary"></div>

                    <section class="uf-ihd-chart-card" aria-label="Internet health timeline">
                        <div class="uf-ihd-chart-header">
                            <p class="uf-ihd-chart-title">Timeline</p>
                            <p class="uf-ihd-chart-range"></p>
                        </div>
                        <div class="uf-ihd-bar-shell">
                            <div class="uf-ihd-bar"></div>
                            <div class="uf-ihd-tooltip" data-visible="false" aria-hidden="true">
                                <div class="uf-ihd-tooltip-title">
                                    <span class="uf-ihd-tooltip-dot"></span>
                                    <span class="uf-ihd-tooltip-title-text"></span>
                                </div>
                                <div class="uf-ihd-tooltip-times">
                                    <span class="uf-ihd-tooltip-start"></span>
                                    <span>-</span>
                                    <span class="uf-ihd-tooltip-end"></span>
                                </div>
                                <div class="uf-ihd-tooltip-duration"></div>
                            </div>
                            <div class="uf-ihd-axis"></div>
                        </div>
                        <div class="uf-ihd-legend"></div>
                    </section>

                    <div class="uf-ihd-lower-grid">
                        <section class="uf-ihd-panel" aria-label="Internet health events">
                            <div class="uf-ihd-panel-header">
                                <div>
                                    <p class="uf-ihd-panel-title">Events</p>
                                    <p class="uf-ihd-panel-subtitle">Click a row or a bar segment to pin or unpin details.</p>
                                </div>
                            </div>
                            <div class="uf-ihd-events"></div>
                        </section>

                        <section class="uf-ihd-panel" aria-label="Selected event details">
                            <div class="uf-ihd-panel-header">
                                <div>
                                    <p class="uf-ihd-panel-title">Selected Segment</p>
                                    <p class="uf-ihd-panel-subtitle">Hover shows the same time range above the bar.</p>
                                </div>
                            </div>
                            <div class="uf-ihd-details"></div>
                        </section>
                    </div>
                </div>
            </div>
        `;

        modal.addEventListener("click", (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });

        modal.querySelector(".uf-ihd-close").addEventListener("click", closeModal);
        modal.querySelector(".uf-ihd-bar").addEventListener("click", handleSegmentClick);
        modal.querySelector(".uf-ihd-bar").addEventListener("pointerover", handleSegmentPointerOver);
        modal.querySelector(".uf-ihd-bar").addEventListener("pointerout", handleSegmentPointerOut);
        modal.querySelector(".uf-ihd-bar").addEventListener("focusin", handleSegmentFocusIn);
        modal.querySelector(".uf-ihd-bar").addEventListener("focusout", handleSegmentFocusOut);
        modal.querySelector(".uf-ihd-bar").addEventListener("keydown", handleSegmentKeyDown);
        modal.querySelector(".uf-ihd-events").addEventListener("click", handleEventRowClick);
        modal.querySelector(".uf-ihd-body").addEventListener("scroll", handleModalBodyScroll, { passive: true });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !modal.hidden) {
                closeModal();
            }
        });

        document.body.appendChild(modal);
        return modal;
    }

    function getTileContainer(tile) {
        return tile.closest("[data-hardware-id]") || tile.closest("[class*='egkguue']");
    }

    function getSiteName(tile) {
        const container = getTileContainer(tile);
        const heading = container?.querySelector(".tile-heading a, a[data-uic-component='Link']");
        const osLink = container?.querySelector("a[data-testid='oslink']");
        const headingText = heading?.textContent?.trim();
        const osTitle = osLink?.getAttribute("title")?.trim();

        return headingText || osTitle || "UniFi Site";
    }

    function getIspName(tile) {
        const container = getTileContainer(tile);
        const element = container?.querySelector(".tile-isp [title], .tile-isp p");
        const title = element?.getAttribute("title")?.trim();
        const text = element?.textContent?.trim();

        return title || text || "Unknown ISP";
    }

    function getConsoleName(tile) {
        const container = getTileContainer(tile);
        const candidates = Array.from(container?.querySelectorAll(".tile-subheading[title], .tile-subheading") || []);

        for (const candidate of candidates) {
            const title = candidate.getAttribute("title")?.trim();
            const text = candidate.textContent?.trim();

            if (title && !title.toLowerCase().includes("last seen")) {
                return title;
            }

            if (text && !text.toLowerCase().includes("last seen")) {
                return text;
            }
        }

        return "Unknown Console";
    }

    function getTimeLabels(tile) {
        const labels = Array.from(tile.querySelectorAll(".label, [data-label]"))
            .map((element) => element.getAttribute("data-label") || element.textContent)
            .map((value) => value?.trim())
            .filter(Boolean);

        if (labels.length >= 3) {
            return labels.slice(0, 3);
        }

        if (labels.length === 2) {
            return [labels[0], labels[1], "Now"];
        }

        if (labels.length === 1) {
            return [labels[0], "", "Now"];
        }

        return ["Start", "Middle", "Now"];
    }

    function getRawSegments(tile) {
        return Array.from(tile.querySelectorAll("[class*='StackedBar-withTooltip']")).map((barItem) => {
            const parent = barItem.parentElement;
            const width = Number.parseFloat(parent?.style?.width || "0");
            const color =
                barItem.style.background ||
                barItem.style.backgroundColor ||
                window.getComputedStyle(barItem).backgroundColor ||
                COLOR_MAP.unknown.color;
            const status = getStatusFromElement(barItem, color);

            return {
                width: Number.isFinite(width) && width > 0 ? width : 1,
                color,
                status,
            };
        });
    }

    function normalizeColor(color) {
        return color.replace(/\s+/g, "").toLowerCase();
    }

    function getStatusText(element) {
        const textParts = [];
        let current = element;

        for (let depth = 0; current && depth < 2; depth += 1) {
            [
                "aria-label",
                "title",
                "data-label",
                "data-state",
                "data-status",
            ].forEach((attribute) => {
                const value = current.getAttribute(attribute)?.trim();

                if (value) {
                    textParts.push(value);
                }
            });

            const text = current.textContent?.trim();

            if (text) {
                textParts.push(text);
            }

            current = current.parentElement;
        }

        return textParts.join(" ");
    }

    function getStatusFromText(text) {
        const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();

        if (!normalized) {
            return null;
        }

        if (normalized.includes("disconnected")) {
            return COLOR_MAP.disconnected;
        }

        if (normalized.includes("latency")) {
            return COLOR_MAP.latency;
        }

        if (normalized.includes("site offline") || normalized.includes("no data") || /\boffline\b/.test(normalized)) {
            return COLOR_MAP.offline;
        }

        if (normalized.includes("healthy")) {
            return COLOR_MAP.healthy;
        }

        return null;
    }

    function getStatusFromElement(element, color) {
        return getStatusFromText(getStatusText(element)) || getStatusFromColor(color);
    }

    function getStatusFromColor(color) {
        const normalized = normalizeColor(color);

        if (normalized.includes("55,190,95")) {
            return COLOR_MAP.healthy;
        }

        if (normalized.includes("238,99,104")) {
            return COLOR_MAP.disconnected;
        }

        if (normalized.includes("223,193,22")) {
            return COLOR_MAP.latency;
        }

        if (normalized.includes("66,71,77")) {
            return COLOR_MAP.offline;
        }

        return {
            ...COLOR_MAP.unknown,
            color,
        };
    }

    function parseClockLabel(label, baseDate) {
        if (!label || label.trim().toLowerCase() === "now") {
            return new Date(baseDate);
        }

        const match = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

        if (!match) {
            return new Date(baseDate);
        }

        let hours = Number.parseInt(match[1], 10);
        const minutes = Number.parseInt(match[2], 10);
        const meridiem = match[3].toUpperCase();

        if (meridiem === "PM" && hours !== 12) {
            hours += 12;
        }

        if (meridiem === "AM" && hours === 12) {
            hours = 0;
        }

        const date = new Date(baseDate);
        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    function buildTimeline(labels) {
        const now = new Date();
        const end = labels[2]?.toLowerCase() === "now"
            ? new Date(now)
            : parseClockLabel(labels[2], now);

        let start = parseClockLabel(labels[0], end);

        while (start >= end) {
            start = new Date(start.getTime() - 24 * 60 * 60 * 1000);
        }

        const visibleHours = Math.round((end.getTime() - start.getTime()) / 3600000);

        if (labels[2]?.toLowerCase() === "now" && visibleHours < 20) {
            start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        }

        let middle = labels[1]
            ? parseClockLabel(labels[1], start)
            : new Date(start.getTime() + 12 * 60 * 60 * 1000);

        while (middle <= start) {
            middle = new Date(middle.getTime() + 24 * 60 * 60 * 1000);
        }

        while (middle >= end) {
            middle = new Date(middle.getTime() - 24 * 60 * 60 * 1000);
        }

        return {
            start,
            middle,
            end,
        };
    }

    function buildSegments(tile) {
        const labels = getTimeLabels(tile);
        const rawSegments = getRawSegments(tile);
        const timeline = buildTimeline(labels);
        const totalWeight = rawSegments.reduce((total, segment) => total + segment.width, 0) || 1;
        const totalMilliseconds = timeline.end.getTime() - timeline.start.getTime();

        let elapsed = 0;

        const segments = rawSegments.map((rawSegment, index) => {
            const isLast = index === rawSegments.length - 1;
            const durationMilliseconds = isLast
                ? totalMilliseconds - elapsed
                : Math.round((rawSegment.width / totalWeight) * totalMilliseconds);

            const start = new Date(timeline.start.getTime() + elapsed);
            const end = new Date(timeline.start.getTime() + elapsed + durationMilliseconds);
            const status = rawSegment.status || getStatusFromColor(rawSegment.color);

            elapsed += durationMilliseconds;

            return {
                index,
                number: index + 1,
                start,
                end,
                durationMilliseconds: Math.max(0, durationMilliseconds),
                width: rawSegment.width,
                percentage: (rawSegment.width / totalWeight) * 100,
                color: rawSegment.color || status.color,
                label: status.label,
                shortLabel: status.shortLabel,
                sort: status.sort,
            };
        });

        return {
            labels,
            timeline,
            segments,
        };
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
        });
    }

    function formatDuration(milliseconds) {
        const totalMinutes = Math.max(1, Math.round(milliseconds / 60000));
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;

        const parts = [];

        if (days > 0) {
            parts.push(`${days}d`);
        }

        if (hours > 0) {
            parts.push(`${hours}h`);
        }

        if (minutes > 0 || parts.length === 0) {
            parts.push(`${minutes}m`);
        }

        return parts.join(" ");
    }

    function getRangeText(segment) {
        return `${formatTime(segment.start)} - ${formatTime(segment.end)}`;
    }

    function summarizeSegments(segments) {
        const disconnectedMs = sumDuration(segments, "Internet Disconnected");
        const latencyMs = sumDuration(segments, "High Latency Detected");
        const offlineMs = segments
            .filter((segment) => segment.label === "Site Offline / No Data")
            .reduce((total, segment) => total + segment.durationMilliseconds, 0);
        const eventCount = segments.filter((segment) => segment.label !== "Healthy").length;
        const currentSegment = segments[segments.length - 1];

        return {
            current: currentSegment?.label || "Unknown",
            disconnected: disconnectedMs > 0 ? formatDuration(disconnectedMs) : "None",
            latency: latencyMs > 0 ? formatDuration(latencyMs) : "None",
            offline: offlineMs > 0 ? formatDuration(offlineMs) : "None",
            events: String(eventCount),
        };
    }

    function sumDuration(segments, label) {
        return segments
            .filter((segment) => segment.label === label)
            .reduce((total, segment) => total + segment.durationMilliseconds, 0);
    }

    function openModal(tile) {
        const modal = createModal();
        const siteName = getSiteName(tile);
        const ispName = getIspName(tile);
        const consoleName = getConsoleName(tile);
        const severity = tile.getAttribute("data-severity") || "Unknown";
        const model = buildSegments(tile);
        const summary = summarizeSegments(model.segments);

        selectedSegmentIndex = null;
        activeTooltipSegmentIndex = null;

        modal.dataset.siteName = siteName;
        modal.ufIhdSegments = model.segments;
        hideSegmentTooltip(modal);

        modal.querySelector(".uf-ihd-title").textContent = `${siteName} Internet Health`;
        modal.querySelector(".uf-ihd-subtitle").textContent =
            `${ispName} · ${consoleName} · ${formatTime(model.timeline.start)} to ${formatTime(model.timeline.end)}`;

        modal.querySelector(".uf-ihd-summary").replaceChildren(
            createSummaryCard("Current", summary.current),
            createSummaryCard("Disconnected", summary.disconnected),
            createSummaryCard("High Latency", summary.latency),
            createSummaryCard("Offline / No Data", summary.offline),
            createSummaryCard("Events", summary.events),
            createSummaryCard("Severity", severity)
        );

        modal.querySelector(".uf-ihd-chart-range").textContent =
            `${formatTime(model.timeline.start)} - ${formatTime(model.timeline.end)}`;

        modal.querySelector(".uf-ihd-axis").replaceChildren(
            createTextSpan(formatTime(model.timeline.start)),
            createTextSpan(formatTime(model.timeline.middle)),
            createTextSpan(model.labels[2]?.toLowerCase() === "now" ? "Now" : formatTime(model.timeline.end))
        );

        modal.querySelector(".uf-ihd-bar").replaceChildren(
            ...model.segments.map((segment) => createSegmentButton(segment))
        );

        modal.querySelector(".uf-ihd-legend").replaceChildren(
            createLegendItem(COLOR_MAP.healthy.color, "Healthy"),
            createLegendItem(COLOR_MAP.disconnected.color, "Internet Disconnected"),
            createLegendItem(COLOR_MAP.latency.color, "High Latency Detected"),
            createLegendItem(COLOR_MAP.offline.color, "Site Offline / No Data")
        );

        renderEvents(modal, model.segments);
        renderSelectedDetails(modal, model.segments);

        modal.hidden = false;
        document.body.style.overflow = "hidden";
        modal.querySelector(".uf-ihd-close").focus();
    }

    function closeModal() {
        const modal = document.getElementById(MODAL_ID);

        if (!modal) {
            return;
        }

        modal.hidden = true;
        document.body.style.overflow = "";
        selectedSegmentIndex = null;
        activeTooltipSegmentIndex = null;

        if (tooltipUpdateFrame !== null) {
            window.cancelAnimationFrame(tooltipUpdateFrame);
            tooltipUpdateFrame = null;
        }

        hideSegmentTooltip(modal);
    }

    function createSummaryCard(label, value) {
        const card = document.createElement("div");
        card.className = "uf-ihd-summary-card";

        const labelElement = document.createElement("p");
        labelElement.className = "uf-ihd-summary-label";
        labelElement.textContent = label;

        const valueElement = document.createElement("p");
        valueElement.className = "uf-ihd-summary-value";
        valueElement.textContent = value;

        card.append(labelElement, valueElement);
        return card;
    }

    function clampValue(value, minimum, maximum) {
        if (maximum < minimum) {
            return minimum;
        }

        return Math.min(Math.max(value, minimum), maximum);
    }

    function measureTooltip(tooltip) {
        const visibleRect = tooltip.getBoundingClientRect();

        if (visibleRect.width > 0 && visibleRect.height > 0) {
            return visibleRect;
        }

        const previousDisplay = tooltip.style.display;
        const previousVisibility = tooltip.style.visibility;

        tooltip.style.display = "block";
        tooltip.style.visibility = "hidden";

        const measuredRect = tooltip.getBoundingClientRect();

        tooltip.style.display = previousDisplay;
        tooltip.style.visibility = previousVisibility;

        return measuredRect;
    }

    function setTooltipVisibility(tooltip, isVisible) {
        tooltip.dataset.visible = isVisible ? "true" : "false";
        tooltip.setAttribute("aria-hidden", isVisible ? "false" : "true");
    }

    function getModalSegments(modal) {
        return modal?.ufIhdSegments || [];
    }

    function getSegmentButton(modal, segmentIndex) {
        return modal?.querySelector(`.uf-ihd-segment[data-segment-index="${segmentIndex}"]`) || null;
    }

    function getSegmentTooltip(modal) {
        return modal?.querySelector(".uf-ihd-tooltip") || null;
    }

    function hideSegmentTooltip(modal) {
        const tooltip = getSegmentTooltip(modal);

        if (!tooltip) {
            return;
        }

        activeTooltipSegmentIndex = null;
        setTooltipVisibility(tooltip, false);
    }

    function updateTooltipContent(tooltip, segment) {
        tooltip.style.setProperty("--uf-ihd-segment-color", segment.color);
        tooltip.querySelector(".uf-ihd-tooltip-title-text").textContent = segment.label;
        tooltip.querySelector(".uf-ihd-tooltip-start").textContent = formatTime(segment.start);
        tooltip.querySelector(".uf-ihd-tooltip-end").textContent = formatTime(segment.end);
        tooltip.querySelector(".uf-ihd-tooltip-duration").textContent =
            `Duration: ${formatDuration(segment.durationMilliseconds)}`;
    }

    function positionSegmentTooltip(button) {
        const modal = button.closest(`#${MODAL_ID}`);
        const tooltip = getSegmentTooltip(modal);
        const shell = button.closest(".uf-ihd-bar-shell");

        if (!tooltip || !shell) {
            return;
        }

        const segmentRect = button.getBoundingClientRect();
        const shellRect = shell.getBoundingClientRect();
        const tooltipRect = measureTooltip(tooltip);
        const tooltipWidth = tooltipRect.width || 210;

        if (segmentRect.width <= 0 || shellRect.width <= 0) {
            return;
        }

        const anchorX = segmentRect.left + (segmentRect.width / 2);
        const minimumCenter = shellRect.left + (tooltipWidth / 2) + TOOLTIP_BOUNDARY_GAP;
        const maximumCenter = shellRect.right - (tooltipWidth / 2) - TOOLTIP_BOUNDARY_GAP;
        const tooltipCenter = maximumCenter < minimumCenter
            ? shellRect.left + (shellRect.width / 2)
            : clampValue(anchorX, minimumCenter, maximumCenter);
        const arrowLeft = clampValue(
            anchorX - tooltipCenter + (tooltipWidth / 2),
            TOOLTIP_ARROW_GAP,
            tooltipWidth - TOOLTIP_ARROW_GAP
        );

        tooltip.style.setProperty("--uf-ihd-tooltip-left", `${Math.round(tooltipCenter)}px`);
        tooltip.style.setProperty("--uf-ihd-tooltip-top", `${Math.round(segmentRect.top - 12)}px`);
        tooltip.style.setProperty("--uf-ihd-tooltip-arrow-left", `${Math.round(arrowLeft)}px`);
    }

    function showSegmentTooltip(button, segment) {
        const modal = button.closest(`#${MODAL_ID}`);
        const tooltip = getSegmentTooltip(modal);

        if (!tooltip) {
            return;
        }

        activeTooltipSegmentIndex = segment.index;
        updateTooltipContent(tooltip, segment);
        setTooltipVisibility(tooltip, true);
        tooltip.style.visibility = "hidden";
        positionSegmentTooltip(button);
        tooltip.style.visibility = "";
    }

    function restoreSelectedSegmentTooltip(button) {
        const modal = button.closest(`#${MODAL_ID}`);

        hideSegmentTooltip(modal);
    }

    function updateVisibleSegmentTooltip(modal) {
        const segments = getModalSegments(modal);
        const segment = activeTooltipSegmentIndex === null || activeTooltipSegmentIndex === undefined
            ? null
            : segments[activeTooltipSegmentIndex];
        const button = segment ? getSegmentButton(modal, segment.index) : null;

        if (!segment || !button) {
            hideSegmentTooltip(modal);
            return;
        }

        positionSegmentTooltip(button);
    }

    function scheduleVisibleTooltipUpdate(modal) {
        if (tooltipUpdateFrame !== null) {
            return;
        }

        tooltipUpdateFrame = window.requestAnimationFrame(() => {
            tooltipUpdateFrame = null;
            updateVisibleSegmentTooltip(modal);
        });
    }

    function getSegmentIndexFromElement(element) {
        const segmentIndex = Number.parseInt(element?.dataset?.segmentIndex || "", 10);

        return Number.isFinite(segmentIndex) ? segmentIndex : null;
    }

    function getSegmentByIndex(modal, segmentIndex) {
        return getModalSegments(modal).find((segment) => segment.index === segmentIndex) || null;
    }

    function getSegmentButtonFromEvent(event) {
        const button = event.target.closest?.(".uf-ihd-segment");
        const bar = event.currentTarget;

        return button && bar.contains(button) ? button : null;
    }

    function getEventRowFromEvent(event) {
        const row = event.target.closest?.(".uf-ihd-event-row");
        const eventsElement = event.currentTarget;

        return row && eventsElement.contains(row) ? row : null;
    }

    function handleSegmentClick(event) {
        const button = getSegmentButtonFromEvent(event);
        const modal = button?.closest(`#${MODAL_ID}`);
        const segmentIndex = getSegmentIndexFromElement(button);
        const segment = segmentIndex === null ? null : getSegmentByIndex(modal, segmentIndex);

        if (!button || !modal || !segment) {
            return;
        }

        toggleSelectedSegment(segment.index, getModalSegments(modal));

        if (button.matches(":hover") || button === document.activeElement) {
            showSegmentTooltip(button, segment);
        }
    }

    function handleSegmentPointerOver(event) {
        const button = getSegmentButtonFromEvent(event);
        const modal = button?.closest(`#${MODAL_ID}`);
        const segmentIndex = getSegmentIndexFromElement(button);
        const segment = segmentIndex === null ? null : getSegmentByIndex(modal, segmentIndex);

        if (!button || !segment || button.contains(event.relatedTarget)) {
            return;
        }

        showSegmentTooltip(button, segment);
    }

    function handleSegmentPointerOut(event) {
        const button = getSegmentButtonFromEvent(event);

        if (!button || button.contains(event.relatedTarget)) {
            return;
        }

        restoreSelectedSegmentTooltip(button);
    }

    function handleSegmentFocusIn(event) {
        const button = getSegmentButtonFromEvent(event);
        const modal = button?.closest(`#${MODAL_ID}`);
        const segmentIndex = getSegmentIndexFromElement(button);
        const segment = segmentIndex === null ? null : getSegmentByIndex(modal, segmentIndex);

        if (!button || !segment) {
            return;
        }

        showSegmentTooltip(button, segment);
    }

    function handleSegmentFocusOut(event) {
        const button = getSegmentButtonFromEvent(event);

        if (!button) {
            return;
        }

        restoreSelectedSegmentTooltip(button);
    }

    function focusSegmentByIndex(modal, segmentIndex) {
        const segment = getSegmentByIndex(modal, segmentIndex);
        const button = segment ? getSegmentButton(modal, segment.index) : null;

        if (!segment || !button) {
            return;
        }

        button.focus();
        showSegmentTooltip(button, segment);
    }

    function handleSegmentKeyDown(event) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            return;
        }

        const button = getSegmentButtonFromEvent(event);
        const modal = button?.closest(`#${MODAL_ID}`);
        const segments = getModalSegments(modal);
        const currentSegmentIndex = getSegmentIndexFromElement(button);
        const currentArrayIndex = segments.findIndex((segment) => segment.index === currentSegmentIndex);

        if (!button || !modal || currentArrayIndex < 0) {
            return;
        }

        let nextArrayIndex = currentArrayIndex;

        if (event.key === "ArrowLeft") {
            nextArrayIndex = Math.max(0, currentArrayIndex - 1);
        } else if (event.key === "ArrowRight") {
            nextArrayIndex = Math.min(segments.length - 1, currentArrayIndex + 1);
        } else if (event.key === "Home") {
            nextArrayIndex = 0;
        } else if (event.key === "End") {
            nextArrayIndex = segments.length - 1;
        }

        event.preventDefault();
        focusSegmentByIndex(modal, segments[nextArrayIndex].index);
    }

    function handleEventRowClick(event) {
        const row = getEventRowFromEvent(event);
        const modal = row?.closest(`#${MODAL_ID}`);
        const segmentIndex = getSegmentIndexFromElement(row);

        if (!row || !modal || segmentIndex === null) {
            return;
        }

        toggleSelectedSegment(segmentIndex, getModalSegments(modal));
    }

    function createSegmentButton(segment) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "uf-ihd-segment";
        button.style.flex = `${segment.width} 1 0`;
        button.style.setProperty("--uf-ihd-segment-color", segment.color);
        button.dataset.segmentIndex = String(segment.index);
        button.dataset.selected = segment.index === selectedSegmentIndex ? "true" : "false";
        button.dataset.small = segment.percentage < 7 ? "true" : "false";
        button.setAttribute(
            "aria-label",
            `${segment.label}, ${getRangeText(segment)}, ${formatDuration(segment.durationMilliseconds)}`
        );

        const visibleLabel = document.createElement("span");
        visibleLabel.className = "uf-ihd-segment-label";
        visibleLabel.textContent = segment.shortLabel;

        button.append(visibleLabel);

        return button;
    }

    function createLegendItem(color, label) {
        const item = document.createElement("div");
        item.className = "uf-ihd-legend-item";

        const dot = document.createElement("span");
        dot.className = "uf-ihd-legend-dot";
        dot.style.background = color;

        const text = document.createElement("span");
        text.textContent = label;

        item.append(dot, text);
        return item;
    }

    function createTextSpan(text) {
        const span = document.createElement("span");
        span.textContent = text;
        return span;
    }

    function renderEvents(modal, segments) {
        const eventsElement = modal.querySelector(".uf-ihd-events");
        const rows = segments.map((segment) => createEventRow(segment));

        eventsElement.replaceChildren(...rows);
    }

    function createEventRow(segment) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "uf-ihd-event-row";
        row.dataset.segmentIndex = String(segment.index);
        row.dataset.selected = segment.index === selectedSegmentIndex ? "true" : "false";
        row.style.setProperty("--uf-ihd-segment-color", segment.color);

        const status = document.createElement("div");
        status.className = "uf-ihd-event-status";

        const dot = document.createElement("span");
        dot.className = "uf-ihd-event-dot";

        const statusText = document.createElement("span");
        statusText.className = "uf-ihd-event-status-text";
        statusText.textContent = `Segment ${segment.number}: ${segment.label}`;

        const time = document.createElement("div");
        time.className = "uf-ihd-event-time";
        time.textContent = getRangeText(segment);

        const duration = document.createElement("div");
        duration.className = "uf-ihd-event-duration";
        duration.textContent = formatDuration(segment.durationMilliseconds);

        status.append(dot, statusText);
        row.append(status, time, duration);
        return row;
    }

    function toggleSelectedSegment(segmentIndex, segments) {
        selectedSegmentIndex = selectedSegmentIndex === segmentIndex ? null : segmentIndex;
        refreshSelection(segments);
    }

    function renderSelectedDetails(modal, segments) {
        const detailsElement = modal.querySelector(".uf-ihd-details");

        if (selectedSegmentIndex === null || selectedSegmentIndex === undefined) {
            const empty = document.createElement("p");
            empty.className = "uf-ihd-detail-empty";
            empty.textContent = "Select a segment or event row to pin details here. Click it again to clear the selection.";
            detailsElement.replaceChildren(empty);
            return;
        }

        const selectedSegment = segments[selectedSegmentIndex];

        if (!selectedSegment) {
            const empty = document.createElement("p");
            empty.className = "uf-ihd-detail-empty";
            empty.textContent = "Select a segment to see details.";
            detailsElement.replaceChildren(empty);
            return;
        }

        const status = document.createElement("div");
        status.className = "uf-ihd-detail-status";
        status.style.setProperty("--uf-ihd-segment-color", selectedSegment.color);

        const dot = document.createElement("span");
        dot.className = "uf-ihd-detail-dot";

        const statusText = document.createElement("span");
        statusText.textContent = selectedSegment.label;

        const list = document.createElement("div");
        list.className = "uf-ihd-detail-list";

        list.append(
            createDetailItem("Segment", String(selectedSegment.number)),
            createDetailItem("Start", formatTime(selectedSegment.start)),
            createDetailItem("End", formatTime(selectedSegment.end)),
            createDetailItem("Range", getRangeText(selectedSegment)),
            createDetailItem("Duration", formatDuration(selectedSegment.durationMilliseconds)),
            createDetailItem("Share", `${selectedSegment.percentage.toFixed(1)}% of visible range`),
            createDetailItem("Timing", "Estimated from visible timeline")
        );

        status.append(dot, statusText);
        detailsElement.replaceChildren(status, list);
    }

    function createDetailItem(key, value) {
        const item = document.createElement("div");
        item.className = "uf-ihd-detail-item";

        const keyElement = document.createElement("div");
        keyElement.className = "uf-ihd-detail-key";
        keyElement.textContent = key;

        const valueElement = document.createElement("div");
        valueElement.className = "uf-ihd-detail-value";
        valueElement.textContent = value;

        item.append(keyElement, valueElement);
        return item;
    }

    function refreshSelection(segments) {
        const modal = document.getElementById(MODAL_ID);

        if (!modal) {
            return;
        }

        modal.querySelectorAll("[data-segment-index]").forEach((element) => {
            element.dataset.selected =
                Number.parseInt(element.dataset.segmentIndex, 10) === selectedSegmentIndex
                    ? "true"
                    : "false";
        });

        renderSelectedDetails(modal, segments);
        hideSegmentTooltip(modal);
    }

    function handleDocumentClick(event) {
        const tile = event.target.closest?.(TILE_SELECTOR);

        if (!tile) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        openModal(tile);
    }

    function handleDocumentPointerDown(event) {
        const tile = event.target.closest?.(TILE_SELECTOR);

        if (!tile) {
            return;
        }

        tile.setAttribute("title", "Click to enlarge internet health details");
    }

    function handleWindowResize() {
        const modal = document.getElementById(MODAL_ID);

        if (!modal || modal.hidden) {
            return;
        }

        scheduleVisibleTooltipUpdate(modal);
    }

    function handleModalBodyScroll(event) {
        const modal = event.currentTarget.closest(`#${MODAL_ID}`);

        hideSegmentTooltip(modal);
    }

    function boot() {
        removeOldUi();
        installStyles();
        createModal();

        document.removeEventListener("click", handleDocumentClick, true);
        document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
        window.removeEventListener("resize", handleWindowResize);

        document.addEventListener("click", handleDocumentClick, true);
        document.addEventListener("pointerdown", handleDocumentPointerDown, true);
        window.addEventListener("resize", handleWindowResize);
    }

    boot();
})();
