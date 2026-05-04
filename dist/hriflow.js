// ==UserScript==
// @name         iFlow Bulk Attendance
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Bulk-fill monthly attendance via "Add live attendance" modal
// @author       galer7
// @match        https://app.hriflow.ro/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hriflow.ro
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @grant        none
// ==/UserScript==
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(function () {
    const CLOCK_IN = "09:00";
    const CLOCK_OUT = "17:00";
    const LOCATION = "Home";
    const DELAY_MS = 1500;
    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    function waitForElement(selector_1) {
        return __awaiter(this, arguments, void 0, function* (selector, root = document, timeout = 10000) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const el = root.querySelector(selector);
                if (el)
                    return el;
                yield wait(200);
            }
            throw new Error(`[iFlow] Element not found: ${selector}`);
        });
    }
    function getDayCells() {
        const cells = document.querySelectorAll(".td-user-schedule-data .td-user-day");
        const results = [];
        cells.forEach((cell) => {
            var _a;
            const dayNumEl = cell.querySelector(".td-day-number");
            if (!dayNumEl)
                return;
            const day = parseInt(((_a = dayNumEl.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || "0", 10);
            if (!day)
                return;
            let status = "fill";
            if (cell.classList.contains("td-no-norm")) {
                status = "skip-weekend";
            }
            else if (cell.classList.contains("td-is-company-free-day")) {
                status = "skip-holiday";
            }
            else if (cell.querySelector(".td-day-has-events")) {
                status = "skip-event";
            }
            results.push({ day, status, element: cell });
        });
        return results;
    }
    function getDateForDay(day) {
        var _a, _b;
        const monthYearText = ((_b = (_a = document.querySelector(".td-month-year-select .td-display-date")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "";
        const match = monthYearText.match(/(\w+)\s+(\d{4})/);
        if (!match) {
            const now = new Date();
            const m = String(now.getMonth() + 1).padStart(2, "0");
            const y = now.getFullYear();
            return `${String(day).padStart(2, "0")}/${m}/${y}`;
        }
        const monthNames = {
            January: "01", February: "02", March: "03", April: "04",
            May: "05", June: "06", July: "07", August: "08",
            September: "09", October: "10", November: "11", December: "12",
            Ianuarie: "01", Februarie: "02", Martie: "03", Aprilie: "04",
            Mai: "05", Iunie: "06", Iulie: "07", August_: "08",
            Septembrie: "09", Octombrie: "10", Noiembrie: "11", Decembrie: "12",
        };
        const monthStr = monthNames[match[1]] || "01";
        const year = match[2];
        return `${String(day).padStart(2, "0")}/${monthStr}/${year}`;
    }
    function setInputValue(input, value) {
        var _a;
        const nativeInputValueSetter = (_a = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")) === null || _a === void 0 ? void 0 : _a.set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, value);
        }
        else {
            input.value = value;
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
    }
    function selectLocation(modal) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const selectWrap = modal.querySelector(".td-select-single");
            if (!selectWrap)
                throw new Error("[iFlow] Location dropdown not found");
            const currentName = (_b = (_a = selectWrap.querySelector(".td-select-single-name")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim();
            if (currentName === LOCATION)
                return;
            selectWrap.click();
            yield wait(500);
            const listWrap = yield waitForElement(".td-select-list", selectWrap, 5000);
            const searchInput = listWrap.querySelector("input.td-element-search");
            if (searchInput) {
                setInputValue(searchInput, LOCATION);
                yield wait(500);
            }
            const items = listWrap.querySelectorAll(".td-elements-list .td-item, .td-elements-list li, .td-elements-list a");
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if ((_c = item.textContent) === null || _c === void 0 ? void 0 : _c.trim().includes(LOCATION)) {
                    item.click();
                    yield wait(300);
                    return;
                }
            }
            throw new Error(`[iFlow] Location "${LOCATION}" not found in dropdown`);
        });
    }
    function fillOneDay(day, log) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            log(`Day ${day}: opening modal...`);
            const addBtn = document.querySelector(".td-attendance-add-btn");
            if (!addBtn)
                throw new Error("[iFlow] 'Add attendance' button not found");
            addBtn.click();
            yield wait(800);
            const modal = yield waitForElement(".modal-container");
            const header = modal.querySelector(".modal-header");
            if (!((_a = header === null || header === void 0 ? void 0 : header.textContent) === null || _a === void 0 ? void 0 : _a.includes("Add live attendance"))) {
                throw new Error("[iFlow] Wrong modal opened");
            }
            log(`Day ${day}: selecting location...`);
            yield selectLocation(modal);
            log(`Day ${day}: setting date...`);
            const dateInput = modal.querySelector("input.hasDatepicker");
            if (!dateInput)
                throw new Error("[iFlow] Date input not found");
            const dateStr = getDateForDay(day);
            setInputValue(dateInput, dateStr);
            yield wait(300);
            log(`Day ${day}: setting clock in/out...`);
            const timeInputs = modal.querySelectorAll(".ui-timepicker-input");
            if (timeInputs.length < 2)
                throw new Error("[iFlow] Time inputs not found");
            setInputValue(timeInputs[0], CLOCK_IN);
            yield wait(200);
            setInputValue(timeInputs[1], CLOCK_OUT);
            yield wait(500);
            const errorEl = modal.querySelector(".alert-danger");
            if (errorEl && errorEl.style.display !== "none") {
                const errMsg = ((_b = errorEl.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "Unknown error";
                log(`Day ${day}: ERROR - ${errMsg}`);
                const cancelBtn = modal.querySelector(".cancel-btn a");
                cancelBtn === null || cancelBtn === void 0 ? void 0 : cancelBtn.click();
                yield wait(500);
                return false;
            }
            log(`Day ${day}: submitting...`);
            const submitBtn = modal.querySelector(".modal-footer .modal-default-button");
            if (!submitBtn)
                throw new Error("[iFlow] Submit button not found");
            submitBtn.click();
            yield wait(DELAY_MS);
            const stillOpen = document.querySelector(".modal-container .modal-header");
            if ((_c = stillOpen === null || stillOpen === void 0 ? void 0 : stillOpen.textContent) === null || _c === void 0 ? void 0 : _c.includes("Add live attendance")) {
                const errorAfter = modal.querySelector(".alert-danger");
                if (errorAfter && errorAfter.style.display !== "none") {
                    log(`Day ${day}: FAILED - ${(_d = errorAfter.textContent) === null || _d === void 0 ? void 0 : _d.trim()}`);
                    const cancelBtn = modal.querySelector(".cancel-btn a");
                    cancelBtn === null || cancelBtn === void 0 ? void 0 : cancelBtn.click();
                    yield wait(500);
                    return false;
                }
            }
            log(`Day ${day}: done`);
            return true;
        });
    }
    // --- UI ---
    function createPanel() {
        const panel = document.createElement("div");
        panel.id = "iflow-bulk-panel";
        panel.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 99999;
      background: #1a1a2e; color: #eee; border-radius: 12px;
      padding: 16px; font-family: system-ui, sans-serif; font-size: 13px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4); min-width: 280px; max-width: 360px;
    `;
        panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <strong style="font-size:14px;">iFlow Bulk Fill</strong>
        <span id="iflow-close" style="cursor:pointer; font-size:18px; opacity:0.6;">&times;</span>
      </div>
      <div id="iflow-status" style="margin-bottom:12px; padding:8px; background:#0f3460; border-radius:6px; max-height:200px; overflow-y:auto; font-size:12px; line-height:1.6;"></div>
      <div style="display:flex; gap:8px;">
        <button id="iflow-dryrun" style="flex:1; padding:8px 12px; border:none; border-radius:6px; background:#e94560; color:#fff; cursor:pointer; font-weight:600;">Dry Run</button>
        <button id="iflow-fill" style="flex:1; padding:8px 12px; border:none; border-radius:6px; background:#0cca4a; color:#fff; cursor:pointer; font-weight:600;">Fill Month</button>
      </div>
    `;
        document.body.appendChild(panel);
        panel.querySelector("#iflow-close").addEventListener("click", () => {
            panel.style.display = panel.style.display === "none" ? "block" : "none";
        });
        panel.querySelector("#iflow-dryrun").addEventListener("click", dryRun);
        panel.querySelector("#iflow-fill").addEventListener("click", fillMonth);
        return panel;
    }
    function log(msg) {
        const status = document.querySelector("#iflow-status");
        if (status) {
            status.innerHTML += `<div>${msg}</div>`;
            status.scrollTop = status.scrollHeight;
        }
        console.log(`[iFlow] ${msg}`);
    }
    function clearLog() {
        const status = document.querySelector("#iflow-status");
        if (status)
            status.innerHTML = "";
    }
    function clearOverlays() {
        document.querySelectorAll(".iflow-overlay").forEach((el) => el.remove());
    }
    function addOverlay(cell, color, label) {
        const existing = cell.querySelector(".iflow-overlay");
        if (existing)
            existing.remove();
        const overlay = document.createElement("div");
        overlay.className = "iflow-overlay";
        overlay.title = label;
        overlay.style.cssText = `
      position: absolute; inset: 0; z-index: 9999;
      background: ${color}; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700; color: #fff; pointer-events: none;
    `;
        overlay.textContent = label;
        cell.style.position = "relative";
        cell.appendChild(overlay);
    }
    function dryRun() {
        clearLog();
        clearOverlays();
        const days = getDayCells();
        let toFill = 0;
        for (const d of days) {
            const cell = d.element;
            switch (d.status) {
                case "fill":
                    addOverlay(cell, "rgba(12, 202, 74, 0.5)", "FILL");
                    toFill++;
                    break;
                case "skip-weekend":
                    addOverlay(cell, "rgba(100, 100, 100, 0.5)", "WE");
                    break;
                case "skip-holiday":
                    addOverlay(cell, "rgba(233, 69, 96, 0.5)", "HOL");
                    break;
                case "skip-event":
                    addOverlay(cell, "rgba(163, 65, 154, 0.5)", "EVT");
                    break;
            }
        }
        log(`Dry run complete: <strong>${toFill}</strong> days to fill, ${days.length - toFill} skipped`);
        log(`<em>Overlays: <span style="color:#0cca4a">GREEN</span>=fill, <span style="color:#666">GREY</span>=weekend, <span style="color:#e94560">RED</span>=holiday, <span style="color:#a3419a">PURPLE</span>=event</em>`);
    }
    function fillMonth() {
        return __awaiter(this, void 0, void 0, function* () {
            clearLog();
            clearOverlays();
            const days = getDayCells();
            const toFill = days.filter((d) => d.status === "fill");
            if (toFill.length === 0) {
                log("Nothing to fill — all days are weekends, holidays, or already have events.");
                return;
            }
            log(`Starting fill for <strong>${toFill.length}</strong> days...`);
            const fillBtn = document.querySelector("#iflow-fill");
            const dryBtn = document.querySelector("#iflow-dryrun");
            fillBtn.disabled = true;
            dryBtn.disabled = true;
            fillBtn.style.opacity = "0.5";
            dryBtn.style.opacity = "0.5";
            let success = 0;
            let failed = 0;
            for (const d of toFill) {
                try {
                    const ok = yield fillOneDay(d.day, log);
                    if (ok) {
                        success++;
                        addOverlay(d.element, "rgba(12, 202, 74, 0.6)", "OK");
                    }
                    else {
                        failed++;
                        addOverlay(d.element, "rgba(233, 69, 96, 0.6)", "ERR");
                    }
                }
                catch (e) {
                    failed++;
                    log(`Day ${d.day}: EXCEPTION - ${e.message}`);
                    addOverlay(d.element, "rgba(233, 69, 96, 0.6)", "ERR");
                    const openModal = document.querySelector(".modal-container .cancel-btn a");
                    if (openModal) {
                        openModal.click();
                        yield wait(500);
                    }
                }
            }
            log(`<strong>Done!</strong> ${success} filled, ${failed} failed.`);
            fillBtn.disabled = false;
            dryBtn.disabled = false;
            fillBtn.style.opacity = "1";
            dryBtn.style.opacity = "1";
        });
    }
    // --- Init ---
    function init() {
        if (document.getElementById("iflow-bulk-panel"))
            return;
        const observer = new MutationObserver(() => {
            if (document.querySelector(".td-user-schedule-data") && !document.getElementById("iflow-bulk-panel")) {
                createPanel();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        if (document.querySelector(".td-user-schedule-data")) {
            createPanel();
        }
    }
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    }
    else {
        init();
    }
})();
