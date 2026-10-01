// ==UserScript==
// @name         iFlow Bulk Attendance
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Bulk-fill monthly attendance from dayData view
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

  // src/lib/bridge.ts
  var BRIDGE_URL = "ws://localhost:9876";
  var RECONNECT_INTERVAL = 5e3;
  var ws = null;
  var scriptName = "unknown";
  var scriptVersion = "0";
  var clientId = "";
  var destroyFn = null;
  function generateId() {
    return Math.random().toString(36).slice(2, 8);
  }
  var trustedEval = null;
  try {
    if (typeof window !== "undefined" && window.trustedTypes?.createPolicy) {
      const policy = window.trustedTypes.createPolicy("tm-bridge", {
        createScript: (s) => s
      });
      trustedEval = (code) => new Function(policy.createScript(code));
    }
  } catch {
  }
  function safeEval(code) {
    if (trustedEval) return trustedEval(code)();
    return new Function(code)();
  }
  function initBridge(name, opts) {
    if (destroyFn) destroyFn();
    scriptName = name;
    clientId = `${name}:${generateId()}`;
    if (typeof opts === "function") {
      destroyFn = opts;
    } else if (opts) {
      scriptVersion = opts.version || "0";
      destroyFn = opts.onDestroy || null;
    }
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
      send("register", { script: scriptName, clientId, version: scriptVersion, url: location.href });
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
  function findElement(msg) {
    if (msg.selector) {
      return document.querySelector(msg.selector);
    }
    if (msg.text) {
      const candidates = document.querySelectorAll(
        msg.role ? `[role="${msg.role}"]` : "a, button, [role='tab'], [role='link'], [role='menuitem'], [role='button']"
      );
      const needle = msg.text.toLowerCase();
      for (let i = 0; i < candidates.length; i++) {
        if (candidates[i].textContent?.trim().toLowerCase().includes(needle)) return candidates[i];
      }
    }
    return null;
  }
  function handleCommand(msg) {
    switch (msg.type) {
      case "hotswap": {
        if (destroyFn) {
          try {
            destroyFn();
          } catch {
          }
          destroyFn = null;
        }
        try {
          safeEval(msg.code || "");
          send("hotswap-result", { id: msg.id, ok: true });
        } catch (e) {
          send("hotswap-result", { id: msg.id, ok: false, error: e.message });
        }
        break;
      }
      case "eval": {
        try {
          const result = safeEval(msg.code || "");
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
      case "click": {
        const el = findElement(msg);
        if (!el) {
          send("click-result", { id: msg.id, ok: false, error: "Element not found" });
          break;
        }
        try {
          el.scrollIntoView({ block: "center" });
          el.click();
          send("click-result", { id: msg.id, ok: true, clicked: el.textContent?.trim().slice(0, 80) });
        } catch (e) {
          send("click-result", { id: msg.id, ok: false, error: e.message });
        }
        break;
      }
      case "navigate": {
        try {
          const targetUrl = msg.url || "";
          const link = document.querySelector(`a[href*="${targetUrl}"]`);
          if (link) {
            link.click();
            send("navigate-result", { id: msg.id, ok: true, method: "link-click", url: link.href });
          } else {
            history.pushState(null, "", targetUrl);
            window.dispatchEvent(new PopStateEvent("popstate"));
            send("navigate-result", { id: msg.id, ok: true, method: "pushstate", url: targetUrl });
          }
        } catch (e) {
          send("navigate-result", { id: msg.id, ok: false, error: e.message });
        }
        break;
      }
      case "extract": {
        try {
          const root = document.querySelector(msg.selector || "body");
          if (!root) {
            send("extract-result", { id: msg.id, ok: false, error: "Root not found" });
            break;
          }
          let data;
          switch (msg.extract) {
            case "text":
              data = root.textContent?.trim().replace(/\s+/g, " ").slice(0, 8e3);
              break;
            case "table": {
              const rows = root.querySelectorAll("tr, [role='row']");
              data = Array.from(rows).map((r) => {
                const cells = r.querySelectorAll("td, th, [role='gridcell'], [role='columnheader']");
                return Array.from(cells).map((c) => c.textContent?.trim().replace(/\s+/g, " ") || "");
              });
              break;
            }
            case "links": {
              const anchors = root.querySelectorAll("a[href]");
              data = Array.from(anchors).map((a) => ({
                text: a.textContent?.trim().slice(0, 80),
                href: a.href
              })).filter((l) => l.text && l.text.length > 0);
              break;
            }
            case "list": {
              const items = root.querySelectorAll("li, [role='listitem'], [role='option']");
              data = Array.from(items).map((i) => i.textContent?.trim().replace(/\s+/g, " ").slice(0, 200) || "");
              break;
            }
            default:
              data = root.textContent?.trim().replace(/\s+/g, " ").slice(0, 8e3);
          }
          send("extract-result", { id: msg.id, ok: true, extract: msg.extract, result: JSON.stringify(data) });
        } catch (e) {
          send("extract-result", { id: msg.id, ok: false, error: e.message });
        }
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

  // src/hriflow.ts
  (function() {
    const CLOCK_IN = "9:00:00";
    const CLOCK_OUT = "17:00:00";
    let panel;
    async function fetchFilledDays(month, year) {
      const user = document.querySelector("#app")?.__vue__?.$store?.state?.user;
      const userId = location.hash.match(/\/user\/(\d+)\//)?.[1];
      if (!user?.session_token || !userId) throw new Error("Session token or user id not found");
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const body = new URLSearchParams({
        user_id: userId,
        page: "-1",
        date_interval_start: `${year}-${month}-01`,
        date_interval_end: `${year}-${month}-${lastDay}`,
        "api_auth[session_token]": user.session_token,
        "api_auth[session_company_id]": user.session_company_id,
        "api_auth[is_mobile_app]": "false"
      });
      const res = await fetch("/api/live_attendance/get_attendance_intervals", { method: "POST", body, credentials: "include" });
      const days = (await res.json()).api_reply?.attendance_days;
      if (!Array.isArray(days)) throw new Error("Unexpected attendance API reply");
      return new Set(days.filter((d) => d.intervals.length > 0).map((d) => parseInt(d.date, 10)));
    }
    function getDayCells(filled) {
      const cells = document.querySelectorAll(".td-user-schedule-data .td-user-day");
      const results = [];
      const headerCells = document.querySelectorAll(".td-week-days > div");
      cells.forEach((cell, idx) => {
        const dayNumEl = cell.querySelector(".td-day-number");
        if (!dayNumEl) return;
        const day = parseInt(dayNumEl.textContent?.trim() || "0", 10);
        if (!day) return;
        let status = "fill";
        const dayName = headerCells[idx]?.querySelector(".td-week-days-align")?.textContent?.trim() || "";
        if (dayName === "Sa" || dayName === "Su") {
          status = "skip-weekend";
        } else if (cell.querySelector(".td-day-has-events")) {
          status = "skip-event";
        } else if (filled.has(day)) {
          status = "skip-filled";
        }
        results.push({ day, status, element: cell });
      });
      return results;
    }
    function getCurrentMonthYear() {
      const fromHash = location.hash.match(/dayData\/\d+\/(\d{2})\/(\d{4})/);
      if (fromHash) return { month: fromHash[1], year: fromHash[2] };
      const text = document.querySelector(".td-month-date")?.textContent?.trim() || "";
      const match = text.match(/(\w+)\s+(\d{4})/);
      if (!match) {
        const now = /* @__PURE__ */ new Date();
        return { month: String(now.getMonth() + 1).padStart(2, "0"), year: String(now.getFullYear()) };
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
      return { month: monthNames[match[1]] || "01", year: match[2] };
    }
    function findVisibleModal() {
      const masks = document.querySelectorAll(".modal-mask");
      for (let i = 0; i < masks.length; i++) {
        if (masks[i].style.display !== "none") {
          const container = masks[i].querySelector(".modal-container");
          if (container) return container;
        }
      }
      return null;
    }
    async function pickTime(input, value) {
      input.focus();
      input.click();
      await wait(400);
      const wrappers = document.querySelectorAll(".ui-timepicker-wrapper");
      for (let w = 0; w < wrappers.length; w++) {
        if (wrappers[w].style.display === "none") continue;
        const items = wrappers[w].querySelectorAll("li");
        for (let i = 0; i < items.length; i++) {
          if (items[i].textContent?.trim() === value) {
            items[i].click();
            await wait(200);
            return;
          }
        }
      }
      throw new Error(`Time "${value}" not found in timepicker`);
    }
    async function fillOneDay(day, month, year) {
      panel.log(`Day ${day}: opening modal...`);
      const addBtn = document.querySelector(".td-attendance-add-btn");
      if (!addBtn) throw new Error("'Add attendance' button not found");
      addBtn.click();
      await wait(800);
      const modal = findVisibleModal();
      if (!modal) throw new Error("Modal didn't open");
      const headerText = modal.querySelector(".modal-header")?.textContent || "";
      if (!headerText.replace(/\s+/g, " ").trim().toLowerCase().includes("add live attendance")) {
        const cancelBtn = modal.querySelector(".cancel-btn a, .modal-close");
        cancelBtn?.click();
        await wait(500);
        throw new Error("Wrong modal opened");
      }
      panel.log(`Day ${day}: setting date...`);
      const dateInput = modal.querySelector("input.hasDatepicker");
      if (!dateInput) throw new Error("Date input not found");
      dateInput.focus();
      jQuery(dateInput).datepicker("show");
      await wait(500);
      const dp = document.getElementById("ui-datepicker-div");
      if (!dp) throw new Error("Datepicker popup not found");
      const dayCells = dp.querySelectorAll("td a");
      let dateClicked = false;
      for (let i = 0; i < dayCells.length; i++) {
        if (dayCells[i].textContent?.trim() === String(day)) {
          dayCells[i].click();
          dateClicked = true;
          break;
        }
      }
      if (!dateClicked) throw new Error(`Day ${day} not found in datepicker`);
      await wait(200);
      panel.log(`Day ${day}: clock in ${CLOCK_IN}...`);
      const timeInputs = modal.querySelectorAll(".ui-timepicker-input");
      if (timeInputs.length < 2) throw new Error("Time inputs not found");
      await pickTime(timeInputs[0], CLOCK_IN);
      panel.log(`Day ${day}: clock out ${CLOCK_OUT}...`);
      await pickTime(timeInputs[1], CLOCK_OUT);
      await wait(500);
      const errorEl = modal.querySelector(".alert-danger");
      if (errorEl && errorEl.style.display !== "none") {
        const errMsg = errorEl.textContent?.trim() || "Unknown error";
        panel.log(`Day ${day}: <span style="color:#e94560">ERROR - ${errMsg}</span>`);
        const cancelBtn = modal.querySelector(".cancel-btn a");
        cancelBtn?.click();
        await wait(500);
        return false;
      }
      panel.log(`Day ${day}: submitting...`);
      const submitBtn = modal.querySelector(".modal-footer .modal-default-button");
      if (!submitBtn) throw new Error("Submit button not found");
      submitBtn.click();
      for (let i = 0; i < 40 && findVisibleModal(); i++) {
        const errorAfter = findVisibleModal()?.querySelector(".alert-danger");
        if (errorAfter && errorAfter.style.display !== "none" && errorAfter.textContent?.trim()) break;
        await wait(250);
      }
      const stillOpen = findVisibleModal();
      if (stillOpen) {
        const errorAfter = stillOpen.querySelector(".alert-danger");
        const errMsg = errorAfter && errorAfter.style.display !== "none" ? errorAfter.textContent?.trim() : "";
        panel.log(`Day ${day}: <span style="color:#e94560">FAILED - ${errMsg || "modal still open after 10s"}</span>`);
        const cancelBtn = stillOpen.querySelector(".cancel-btn a, .modal-close");
        cancelBtn?.click();
        await wait(500);
        return false;
      }
      await wait(500);
      panel.log(`Day ${day}: <span style="color:#0cca4a">done</span>`);
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
    async function dryRun() {
      panel.clear();
      clearOverlays();
      const { month, year } = getCurrentMonthYear();
      let filled;
      try {
        filled = await fetchFilledDays(month, year);
      } catch (e) {
        panel.logError(e);
        return;
      }
      const days = getDayCells(filled);
      if (days.length === 0) {
        panel.log("No day cells found \u2014 are you on the dayData page?");
        return;
      }
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
          case "skip-event":
            addOverlay(d.element, "rgba(163, 65, 154, 0.5)", "EVT");
            break;
          case "skip-filled":
            addOverlay(d.element, "rgba(52, 120, 246, 0.5)", "DONE");
            break;
        }
      }
      panel.log(`Dry run (${month}/${year}): <strong>${toFill}</strong> to fill, ${days.length - toFill} skipped`);
      panel.log(`<em><span style="color:#0cca4a">GREEN</span>=fill <span style="color:#3478f6">BLUE</span>=already filled <span style="color:#666">GREY</span>=weekend (Sa/Su only) <span style="color:#a3419a">PURPLE</span>=existing event</em>`);
    }
    async function fillMonth() {
      panel.clear();
      clearOverlays();
      const { month, year } = getCurrentMonthYear();
      const buttons = panel.element.querySelectorAll("button");
      buttons.forEach((b) => {
        b.disabled = true;
        b.style.opacity = "0.5";
      });
      try {
        for (let pass = 1; pass <= 2; pass++) {
          const toFill = getDayCells(await fetchFilledDays(month, year)).filter((d) => d.status === "fill");
          if (toFill.length === 0) {
            if (pass === 1) panel.log("Nothing to fill \u2014 every workday already has attendance or an event.");
            break;
          }
          panel.log(`Pass ${pass}: filling <strong>${toFill.length}</strong> days for ${month}/${year}...`);
          for (const d of toFill) {
            try {
              await fillOneDay(d.day, month, year);
            } catch (e) {
              panel.logError(e);
              const openModal = findVisibleModal();
              if (openModal) {
                const cancelBtn = openModal.querySelector(".cancel-btn a, .modal-close");
                cancelBtn?.click();
                await wait(500);
              }
            }
          }
        }
        const days = getDayCells(await fetchFilledDays(month, year));
        const missing = days.filter((d) => d.status === "fill");
        days.forEach((d) => {
          if (d.status === "skip-filled") addOverlay(d.element, "rgba(12, 202, 74, 0.6)", "OK");
        });
        missing.forEach((d) => addOverlay(d.element, "rgba(233, 69, 96, 0.6)", "ERR"));
        const filledCount = days.filter((d) => d.status === "skip-filled").length;
        panel.log(missing.length === 0 ? `<strong>Done!</strong> ${filledCount} workdays filled (${filledCount * 8}h).` : `<strong>Done with gaps.</strong> Still missing: ${missing.map((d) => d.day).join(", ")}`);
      } catch (e) {
        panel.logError(e);
      } finally {
        buttons.forEach((b) => {
          b.disabled = false;
          b.style.opacity = "1";
        });
      }
    }
    let observer = null;
    function destroy() {
      if (panel) panel.element.remove();
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      clearOverlays();
    }
    function init() {
      if (document.querySelector(".tm-panel")) return;
      observer = new MutationObserver(() => {
        const onDayData = location.hash.includes("dayData");
        if (onDayData && document.querySelector(".td-user-schedule-data") && !document.querySelector(".tm-panel")) {
          setup();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      if (location.hash.includes("dayData") && document.querySelector(".td-user-schedule-data")) {
        setup();
      }
    }
    function setup() {
      panel = createPanel("iFlow Bulk Fill", [
        { id: "iflow-dryrun", label: "Dry Run", color: "#e94560", onClick: dryRun },
        { id: "iflow-fill", label: "Fill Month", color: "#0cca4a", onClick: fillMonth }
      ]);
    }
    initBridge("hriflow", destroy);
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  })();
})();
