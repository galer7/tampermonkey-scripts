// ==UserScript==
// @name         iFlow Bulk Attendance
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Bulk-fill monthly attendance via "Add live attendance" modal
// @author       galer7
// @match        https://app.hriflow.ro/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hriflow.ro
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @grant        none
// ==/UserScript==

(() => {
  // src/lib/dom.ts
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  var SelectorError = class extends Error {
    constructor(selector, html) {
      super(`Selector not found: ${selector}`);
      this.name = "SelectorError";
      this.selector = selector;
      this.html = html;
    }
    toCopyable() {
      return [
        `SELECTOR FAILED: ${this.selector}`,
        ``,
        `Surrounding HTML:`,
        this.html
      ].join("\n");
    }
  };
  function dumpContext(root, maxLength = 3e3) {
    const el = root instanceof Document ? root.body : root;
    const html = el.innerHTML;
    if (html.length <= maxLength) return html;
    return html.slice(0, maxLength) + "\n... (truncated)";
  }
  async function waitForElement(selector, root = document, timeout = 1e4) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = root.querySelector(selector);
      if (el) return el;
      await wait(200);
    }
    const context = dumpContext(root);
    throw new SelectorError(selector, context);
  }
  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  // src/lib/bridge.ts
  var BRIDGE_URL = "ws://localhost:9876";
  var RECONNECT_INTERVAL = 5e3;
  var ws = null;
  var scriptName = "unknown";
  function initBridge(name) {
    scriptName = name;
    connect();
  }
  function connect() {
    try {
      ws = new WebSocket(BRIDGE_URL);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      send("register", { script: scriptName, url: location.href });
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleCommand(msg);
      } catch {
      }
    };
    ws.onclose = () => {
      ws = null;
      scheduleReconnect();
    };
    ws.onerror = () => {
      ws?.close();
    };
  }
  function scheduleReconnect() {
    setTimeout(connect, RECONNECT_INTERVAL);
  }
  function send(type, data = {}) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, script: scriptName, ts: Date.now(), ...data }));
    }
  }
  function handleCommand(msg) {
    switch (msg.type) {
      case "eval": {
        try {
          const result = new Function(msg.code || "")();
          send("eval-result", { id: msg.id, ok: true, result: String(result) });
        } catch (e) {
          send("eval-result", { id: msg.id, ok: false, error: e.message });
        }
        break;
      }
      case "snapshot": {
        const el = document.querySelector(msg.selector || "body");
        const html = el ? el.innerHTML.slice(0, 1e4) : null;
        send("snapshot-result", { id: msg.id, selector: msg.selector, html });
        break;
      }
      case "probe": {
        const el = document.querySelector(msg.selector || "body");
        send("probe-result", { id: msg.id, selector: msg.selector, found: !!el });
        break;
      }
      case "ping": {
        send("pong");
        break;
      }
    }
  }
  function bridgeLog(level, message, data) {
    send("log", { level, message, data });
  }

  // src/lib/panel.ts
  function createPanel(title, buttons = []) {
    const panel = document.createElement("div");
    panel.className = "tm-panel";
    panel.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 99999;
    background: #1a1a2e; color: #eee; border-radius: 12px;
    padding: 16px; font-family: system-ui, sans-serif; font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4); min-width: 280px; max-width: 360px;
  `;
    const header = document.createElement("div");
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;";
    header.innerHTML = `<strong style="font-size:14px;">${title}</strong>`;
    const closeBtn = document.createElement("span");
    closeBtn.textContent = "\xD7";
    closeBtn.style.cssText = "cursor:pointer; font-size:18px; opacity:0.6;";
    closeBtn.addEventListener("click", () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });
    header.appendChild(closeBtn);
    const statusEl = document.createElement("div");
    statusEl.className = "tm-panel-status";
    statusEl.style.cssText = `
    margin-bottom: 12px; padding: 8px; background: #0f3460;
    border-radius: 6px; max-height: 200px; overflow-y: auto;
    font-size: 12px; line-height: 1.6;
  `;
    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display:flex; gap:8px;";
    panel.appendChild(header);
    panel.appendChild(statusEl);
    panel.appendChild(buttonRow);
    document.body.appendChild(panel);
    function log(msg) {
      statusEl.innerHTML += `<div>${msg}</div>`;
      statusEl.scrollTop = statusEl.scrollHeight;
      console.log(`[${title}] ${msg}`);
      bridgeLog("info", msg.replace(/<[^>]*>/g, ""));
    }
    function clear() {
      statusEl.innerHTML = "";
    }
    function logError(error) {
      if (error instanceof SelectorError) {
        const id = `tm-err-${Date.now()}`;
        log(`<span style="color:#e94560">ERROR: ${error.message}</span>`);
        log(`<details><summary style="cursor:pointer;color:#f59e0b;">Show HTML context (click to copy)</summary><pre id="${id}" style="font-size:10px;max-height:150px;overflow:auto;white-space:pre-wrap;background:#111;padding:8px;border-radius:4px;cursor:pointer;">${escapeHtml(error.html)}</pre></details>`);
        setTimeout(() => {
          const pre = document.getElementById(id);
          if (pre) {
            pre.addEventListener("click", () => {
              navigator.clipboard.writeText(error.toCopyable());
              pre.style.outline = "2px solid #0cca4a";
              setTimeout(() => {
                pre.style.outline = "";
              }, 1e3);
            });
          }
        }, 100);
      } else if (error instanceof Error) {
        log(`<span style="color:#e94560">ERROR: ${error.message}</span>`);
      } else {
        log(`<span style="color:#e94560">ERROR: ${String(error)}</span>`);
      }
    }
    function escapeHtml(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    function renderButtons(btns) {
      buttonRow.innerHTML = "";
      for (const btn of btns) {
        const el = document.createElement("button");
        el.id = btn.id;
        el.textContent = btn.label;
        el.style.cssText = `
        flex: 1; padding: 8px 12px; border: none; border-radius: 6px;
        background: ${btn.color}; color: #fff; cursor: pointer; font-weight: 600;
      `;
        el.addEventListener("click", btn.onClick);
        buttonRow.appendChild(el);
      }
    }
    renderButtons(buttons);
    return {
      log,
      clear,
      logError,
      setButtons: renderButtons,
      show: () => {
        panel.style.display = "block";
      },
      hide: () => {
        panel.style.display = "none";
      },
      toggle: () => {
        panel.style.display = panel.style.display === "none" ? "block" : "none";
      },
      element: panel
    };
  }

  // src/lib/probe.ts
  function probe(selector, label, root = document) {
    const els = root.querySelectorAll(selector);
    return { selector, label, found: els.length > 0, count: els.length };
  }
  function probeAll(selectors, root = document) {
    return selectors.map((s) => probe(s.selector, s.label, root));
  }
  function logProbeResults(results, panel) {
    let allGood = true;
    for (const r of results) {
      if (r.found) {
        panel.log(`<span style="color:#0cca4a">\u2713</span> ${r.label} <span style="opacity:0.5">(${r.count})</span>`);
      } else {
        panel.log(`<span style="color:#e94560">\u2717</span> ${r.label} \u2014 <code>${r.selector}</code>`);
        allGood = false;
      }
    }
    if (allGood) {
      panel.log(`<strong style="color:#0cca4a">All selectors OK</strong>`);
    } else {
      panel.log(`<strong style="color:#e94560">Some selectors missing \u2014 UI may have changed</strong>`);
    }
  }

  // src/hriflow.ts
  (function() {
    const CLOCK_IN = "9:00";
    const CLOCK_OUT = "17:00";
    const LOCATION = "Home";
    const DELAY_MS = 1500;
    const SELECTORS = {
      dayCells: ".td-user-schedule-data .td-user-day",
      dayNumber: ".td-day-number",
      dayHasEvents: ".td-day-has-events",
      addBtn: ".td-attendance-add-btn",
      modalMask: ".modal-mask",
      modalContainer: ".modal-container",
      modalHeader: ".modal-header",
      locationSelect: ".td-select-single",
      locationName: ".td-select-single-name",
      locationList: ".td-select-list",
      locationSearch: "input.td-element-search",
      locationItems: ".td-elements-list .td-item, .td-elements-list li, .td-elements-list a",
      dateInput: "input.hasDatepicker",
      timeInput: ".ui-timepicker-input",
      timepickerWrapper: ".ui-timepicker-wrapper",
      alertDanger: ".alert-danger",
      submitBtn: ".modal-footer .modal-default-button",
      cancelBtn: ".cancel-btn a",
      monthDisplay: ".td-month-year-select .td-display-date"
    };
    let panel;
    function getDayCells() {
      const cells = document.querySelectorAll(SELECTORS.dayCells);
      const results = [];
      cells.forEach((cell) => {
        const dayNumEl = cell.querySelector(SELECTORS.dayNumber);
        if (!dayNumEl) return;
        const day = parseInt(dayNumEl.textContent?.trim() || "0", 10);
        if (!day) return;
        let status = "fill";
        if (cell.classList.contains("td-no-norm")) {
          status = "skip-weekend";
        } else if (cell.classList.contains("td-is-company-free-day")) {
          status = "skip-holiday";
        } else if (cell.querySelector(SELECTORS.dayHasEvents)) {
          status = "skip-event";
        }
        results.push({ day, status, element: cell });
      });
      return results;
    }
    function getDateForDay(day) {
      const monthYearText = document.querySelector(SELECTORS.monthDisplay)?.textContent?.trim() || "";
      const match = monthYearText.match(/(\w+)\s+(\d{4})/);
      if (!match) {
        const now = /* @__PURE__ */ new Date();
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const y = now.getFullYear();
        return `${String(day).padStart(2, "0")}/${m}/${y}`;
      }
      const monthNames = {
        January: "01",
        February: "02",
        March: "03",
        April: "04",
        May: "05",
        June: "06",
        July: "07",
        August: "08",
        September: "09",
        October: "10",
        November: "11",
        December: "12",
        Ianuarie: "01",
        Februarie: "02",
        Martie: "03",
        Aprilie: "04",
        Mai: "05",
        Iunie: "06",
        Iulie: "07",
        August_: "08",
        Septembrie: "09",
        Octombrie: "10",
        Noiembrie: "11",
        Decembrie: "12"
      };
      const monthStr = monthNames[match[1]] || "01";
      const year = match[2];
      return `${String(day).padStart(2, "0")}/${monthStr}/${year}`;
    }
    function findVisibleModal() {
      const masks = document.querySelectorAll(SELECTORS.modalMask);
      for (let i = 0; i < masks.length; i++) {
        if (masks[i].style.display !== "none") {
          const container = masks[i].querySelector(SELECTORS.modalContainer);
          if (container) return container;
        }
      }
      return null;
    }
    async function waitForVisibleModal(timeout = 1e4) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const modal = findVisibleModal();
        if (modal) return modal;
        await wait(200);
      }
      throw new Error("No visible modal found");
    }
    async function selectLocation(modal) {
      const selectWrap = modal.querySelector(SELECTORS.locationSelect);
      if (!selectWrap) throw new Error("Location dropdown not found");
      const currentName = selectWrap.querySelector(SELECTORS.locationName)?.textContent?.trim();
      if (currentName === LOCATION) return;
      selectWrap.click();
      await wait(500);
      const listWrap = await waitForElement(SELECTORS.locationList, selectWrap, 5e3);
      const searchInput = listWrap.querySelector(SELECTORS.locationSearch);
      if (searchInput) {
        setInputValue(searchInput, LOCATION);
        await wait(500);
      }
      const items = listWrap.querySelectorAll(SELECTORS.locationItems);
      for (let i = 0; i < items.length; i++) {
        if (items[i].textContent?.trim().includes(LOCATION)) {
          items[i].click();
          await wait(300);
          return;
        }
      }
      throw new Error(`Location "${LOCATION}" not found in dropdown`);
    }
    async function selectTimepickerValue(input, value) {
      input.focus();
      input.click();
      await wait(400);
      const wrappers = document.querySelectorAll(SELECTORS.timepickerWrapper);
      for (let w = 0; w < wrappers.length; w++) {
        const wrapper = wrappers[w];
        if (wrapper.style.display === "none") continue;
        const items = wrapper.querySelectorAll("li");
        for (let i = 0; i < items.length; i++) {
          if (items[i].textContent?.trim() === value) {
            items[i].click();
            await wait(300);
            return;
          }
        }
      }
      throw new Error(`Time value "${value}" not found in timepicker`);
    }
    async function fillOneDay(day) {
      panel.log(`Day ${day}: opening modal...`);
      const addBtn = document.querySelector(SELECTORS.addBtn);
      if (!addBtn) throw new Error("'Add attendance' button not found");
      addBtn.click();
      await wait(800);
      const modal = await waitForVisibleModal();
      const headerText = modal.querySelector(SELECTORS.modalHeader)?.textContent || "";
      if (!headerText.replace(/\s+/g, " ").trim().toLowerCase().includes("add live attendance")) {
        const cancelBtn = modal.querySelector(`${SELECTORS.cancelBtn}, .modal-close`);
        cancelBtn?.click();
        await wait(500);
        throw new Error("Wrong modal opened");
      }
      panel.log(`Day ${day}: selecting location...`);
      await selectLocation(modal);
      panel.log(`Day ${day}: setting date...`);
      const dateInput = modal.querySelector(SELECTORS.dateInput);
      if (!dateInput) throw new Error("Date input not found");
      setInputValue(dateInput, getDateForDay(day));
      await wait(300);
      panel.log(`Day ${day}: setting clock in ${CLOCK_IN}...`);
      const timeInputs = modal.querySelectorAll(SELECTORS.timeInput);
      if (timeInputs.length < 2) throw new Error("Time inputs not found");
      await selectTimepickerValue(timeInputs[0], CLOCK_IN);
      panel.log(`Day ${day}: setting clock out ${CLOCK_OUT}...`);
      await selectTimepickerValue(timeInputs[1], CLOCK_OUT);
      await wait(500);
      const errorEl = modal.querySelector(SELECTORS.alertDanger);
      if (errorEl && errorEl.style.display !== "none") {
        const errMsg = errorEl.textContent?.trim() || "Unknown error";
        panel.log(`Day ${day}: ERROR - ${errMsg}`);
        const cancelBtn = modal.querySelector(SELECTORS.cancelBtn);
        cancelBtn?.click();
        await wait(500);
        return false;
      }
      panel.log(`Day ${day}: submitting...`);
      const submitBtn = modal.querySelector(SELECTORS.submitBtn);
      if (!submitBtn) throw new Error("Submit button not found");
      submitBtn.click();
      await wait(DELAY_MS);
      const stillOpen = findVisibleModal();
      if (stillOpen) {
        const errorAfter = stillOpen.querySelector(SELECTORS.alertDanger);
        if (errorAfter && errorAfter.style.display !== "none") {
          panel.log(`Day ${day}: FAILED - ${errorAfter.textContent?.trim()}`);
          const cancelBtn = stillOpen.querySelector(SELECTORS.cancelBtn);
          cancelBtn?.click();
          await wait(500);
          return false;
        }
      }
      panel.log(`Day ${day}: done`);
      return true;
    }
    function clearOverlays() {
      document.querySelectorAll(".iflow-overlay").forEach((el) => el.remove());
    }
    function addOverlay(cell, color, label) {
      const existing = cell.querySelector(".iflow-overlay");
      if (existing) existing.remove();
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
    function runProbe() {
      panel.clear();
      const selectorList = Object.entries(SELECTORS).map(([label, selector]) => ({ label, selector }));
      const results = probeAll(selectorList);
      logProbeResults(results, panel);
    }
    function dryRun() {
      panel.clear();
      clearOverlays();
      const days = getDayCells();
      let toFill = 0;
      for (const d of days) {
        switch (d.status) {
          case "fill":
            addOverlay(d.element, "rgba(12, 202, 74, 0.5)", "FILL");
            toFill++;
            break;
          case "skip-weekend":
            addOverlay(d.element, "rgba(100, 100, 100, 0.5)", "WE");
            break;
          case "skip-holiday":
            addOverlay(d.element, "rgba(233, 69, 96, 0.5)", "HOL");
            break;
          case "skip-event":
            addOverlay(d.element, "rgba(163, 65, 154, 0.5)", "EVT");
            break;
        }
      }
      panel.log(`Dry run: <strong>${toFill}</strong> to fill, ${days.length - toFill} skipped`);
      panel.log(`<em><span style="color:#0cca4a">GREEN</span>=fill <span style="color:#666">GREY</span>=weekend <span style="color:#e94560">RED</span>=holiday <span style="color:#a3419a">PURPLE</span>=event</em>`);
    }
    async function fillMonth() {
      panel.clear();
      clearOverlays();
      const days = getDayCells();
      const toFill = days.filter((d) => d.status === "fill");
      if (toFill.length === 0) {
        panel.log("Nothing to fill \u2014 all days are weekends, holidays, or already have events.");
        return;
      }
      panel.log(`Starting fill for <strong>${toFill.length}</strong> days...`);
      const buttons = panel.element.querySelectorAll("button");
      buttons.forEach((b) => {
        b.disabled = true;
        b.style.opacity = "0.5";
      });
      let success = 0;
      let failed = 0;
      for (const d of toFill) {
        try {
          const ok = await fillOneDay(d.day);
          if (ok) {
            success++;
            addOverlay(d.element, "rgba(12, 202, 74, 0.6)", "OK");
          } else {
            failed++;
            addOverlay(d.element, "rgba(233, 69, 96, 0.6)", "ERR");
          }
        } catch (e) {
          failed++;
          panel.logError(e);
          addOverlay(d.element, "rgba(233, 69, 96, 0.6)", "ERR");
          const openModal = findVisibleModal();
          if (openModal) {
            const cancelBtn = openModal.querySelector(`${SELECTORS.cancelBtn}, .modal-close`);
            cancelBtn?.click();
            await wait(500);
          }
        }
      }
      panel.log(`<strong>Done!</strong> ${success} filled, ${failed} failed.`);
      buttons.forEach((b) => {
        b.disabled = false;
        b.style.opacity = "1";
      });
    }
    function init() {
      if (document.querySelector(".tm-panel")) return;
      const observer = new MutationObserver(() => {
        if (document.querySelector(SELECTORS.dayCells) && !document.querySelector(".tm-panel")) {
          setup();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      if (document.querySelector(SELECTORS.dayCells)) {
        setup();
      }
    }
    function setup() {
      panel = createPanel("iFlow Bulk Fill", [
        { id: "iflow-probe", label: "Probe", color: "#3b82f6", onClick: runProbe },
        { id: "iflow-dryrun", label: "Dry Run", color: "#e94560", onClick: dryRun },
        { id: "iflow-fill", label: "Fill Month", color: "#0cca4a", onClick: fillMonth }
      ]);
    }
    initBridge("hriflow");
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
})();
