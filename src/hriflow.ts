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

(function () {
  const CLOCK_IN = "09:00";
  const CLOCK_OUT = "17:00";
  const LOCATION = "Home";
  const DELAY_MS = 1500;

  type DayStatus = "fill" | "skip-weekend" | "skip-holiday" | "skip-event";

  interface DayInfo {
    day: number;
    status: DayStatus;
    element: HTMLElement;
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForElement(selector: string, root: Element | Document = document, timeout = 10000): Promise<HTMLElement> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = root.querySelector(selector);
      if (el) return el as HTMLElement;
      await wait(200);
    }
    throw new Error(`[iFlow] Element not found: ${selector}`);
  }

  function getDayCells(): DayInfo[] {
    const cells = document.querySelectorAll<HTMLElement>(".td-user-schedule-data .td-user-day");
    const results: DayInfo[] = [];

    cells.forEach((cell) => {
      const dayNumEl = cell.querySelector(".td-day-number");
      if (!dayNumEl) return;
      const day = parseInt(dayNumEl.textContent?.trim() || "0", 10);
      if (!day) return;

      let status: DayStatus = "fill";

      if (cell.classList.contains("td-no-norm")) {
        status = "skip-weekend";
      } else if (cell.classList.contains("td-is-company-free-day")) {
        status = "skip-holiday";
      } else if (cell.querySelector(".td-day-has-events")) {
        status = "skip-event";
      }

      results.push({ day, status, element: cell });
    });

    return results;
  }

  function getDateForDay(day: number): string {
    const monthYearText = document.querySelector(".td-month-year-select .td-display-date")?.textContent?.trim() || "";
    const match = monthYearText.match(/(\w+)\s+(\d{4})/);
    if (!match) {
      const now = new Date();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const y = now.getFullYear();
      return `${String(day).padStart(2, "0")}/${m}/${y}`;
    }
    const monthNames: Record<string, string> = {
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

  function setInputValue(input: HTMLInputElement, value: string) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, "value"
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  async function selectLocation(modal: HTMLElement) {
    const selectWrap = modal.querySelector(".td-select-single") as HTMLElement;
    if (!selectWrap) throw new Error("[iFlow] Location dropdown not found");

    const currentName = selectWrap.querySelector(".td-select-single-name")?.textContent?.trim();
    if (currentName === LOCATION) return;

    selectWrap.click();
    await wait(500);

    const listWrap = await waitForElement(".td-select-list", selectWrap, 5000);
    const searchInput = listWrap.querySelector("input.td-element-search") as HTMLInputElement;
    if (searchInput) {
      setInputValue(searchInput, LOCATION);
      await wait(500);
    }

    const items = listWrap.querySelectorAll<HTMLElement>(".td-elements-list .td-item, .td-elements-list li, .td-elements-list a");
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.textContent?.trim().includes(LOCATION)) {
        (item as HTMLElement).click();
        await wait(300);
        return;
      }
    }
    throw new Error(`[iFlow] Location "${LOCATION}" not found in dropdown`);
  }

  async function fillOneDay(day: number, log: (msg: string) => void): Promise<boolean> {
    log(`Day ${day}: opening modal...`);

    const addBtn = document.querySelector(".td-attendance-add-btn") as HTMLElement;
    if (!addBtn) throw new Error("[iFlow] 'Add attendance' button not found");
    addBtn.click();
    await wait(800);

    const modal = await waitForElement(".modal-container");
    const header = modal.querySelector(".modal-header");
    if (!header?.textContent?.includes("Add live attendance")) {
      throw new Error("[iFlow] Wrong modal opened");
    }

    log(`Day ${day}: selecting location...`);
    await selectLocation(modal);

    log(`Day ${day}: setting date...`);
    const dateInput = modal.querySelector("input.hasDatepicker") as HTMLInputElement;
    if (!dateInput) throw new Error("[iFlow] Date input not found");
    const dateStr = getDateForDay(day);
    setInputValue(dateInput, dateStr);
    await wait(300);

    log(`Day ${day}: setting clock in/out...`);
    const timeInputs = modal.querySelectorAll<HTMLInputElement>(".ui-timepicker-input");
    if (timeInputs.length < 2) throw new Error("[iFlow] Time inputs not found");
    setInputValue(timeInputs[0], CLOCK_IN);
    await wait(200);
    setInputValue(timeInputs[1], CLOCK_OUT);
    await wait(500);

    const errorEl = modal.querySelector(".alert-danger") as HTMLElement;
    if (errorEl && errorEl.style.display !== "none") {
      const errMsg = errorEl.textContent?.trim() || "Unknown error";
      log(`Day ${day}: ERROR - ${errMsg}`);
      const cancelBtn = modal.querySelector(".cancel-btn a") as HTMLElement;
      cancelBtn?.click();
      await wait(500);
      return false;
    }

    log(`Day ${day}: submitting...`);
    const submitBtn = modal.querySelector(".modal-footer .modal-default-button") as HTMLElement;
    if (!submitBtn) throw new Error("[iFlow] Submit button not found");
    submitBtn.click();
    await wait(DELAY_MS);

    const stillOpen = document.querySelector(".modal-container .modal-header");
    if (stillOpen?.textContent?.includes("Add live attendance")) {
      const errorAfter = modal.querySelector(".alert-danger") as HTMLElement;
      if (errorAfter && errorAfter.style.display !== "none") {
        log(`Day ${day}: FAILED - ${errorAfter.textContent?.trim()}`);
        const cancelBtn = modal.querySelector(".cancel-btn a") as HTMLElement;
        cancelBtn?.click();
        await wait(500);
        return false;
      }
    }

    log(`Day ${day}: done`);
    return true;
  }

  // --- UI ---

  function createPanel(): HTMLElement {
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

    panel.querySelector("#iflow-close")!.addEventListener("click", () => {
      panel.style.display = panel.style.display === "none" ? "block" : "none";
    });

    panel.querySelector("#iflow-dryrun")!.addEventListener("click", dryRun);
    panel.querySelector("#iflow-fill")!.addEventListener("click", fillMonth);

    return panel;
  }

  function log(msg: string) {
    const status = document.querySelector("#iflow-status");
    if (status) {
      status.innerHTML += `<div>${msg}</div>`;
      status.scrollTop = status.scrollHeight;
    }
    console.log(`[iFlow] ${msg}`);
  }

  function clearLog() {
    const status = document.querySelector("#iflow-status");
    if (status) status.innerHTML = "";
  }

  function clearOverlays() {
    document.querySelectorAll(".iflow-overlay").forEach((el) => el.remove());
  }

  function addOverlay(cell: HTMLElement, color: string, label: string) {
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

  async function fillMonth() {
    clearLog();
    clearOverlays();
    const days = getDayCells();
    const toFill = days.filter((d) => d.status === "fill");

    if (toFill.length === 0) {
      log("Nothing to fill — all days are weekends, holidays, or already have events.");
      return;
    }

    log(`Starting fill for <strong>${toFill.length}</strong> days...`);

    const fillBtn = document.querySelector("#iflow-fill") as HTMLButtonElement;
    const dryBtn = document.querySelector("#iflow-dryrun") as HTMLButtonElement;
    fillBtn.disabled = true;
    dryBtn.disabled = true;
    fillBtn.style.opacity = "0.5";
    dryBtn.style.opacity = "0.5";

    let success = 0;
    let failed = 0;

    for (const d of toFill) {
      try {
        const ok = await fillOneDay(d.day, log);
        if (ok) {
          success++;
          addOverlay(d.element, "rgba(12, 202, 74, 0.6)", "OK");
        } else {
          failed++;
          addOverlay(d.element, "rgba(233, 69, 96, 0.6)", "ERR");
        }
      } catch (e: any) {
        failed++;
        log(`Day ${d.day}: EXCEPTION - ${e.message}`);
        addOverlay(d.element, "rgba(233, 69, 96, 0.6)", "ERR");
        const openModal = document.querySelector(".modal-container .cancel-btn a") as HTMLElement;
        if (openModal) {
          openModal.click();
          await wait(500);
        }
      }
    }

    log(`<strong>Done!</strong> ${success} filled, ${failed} failed.`);
    fillBtn.disabled = false;
    dryBtn.disabled = false;
    fillBtn.style.opacity = "1";
    dryBtn.style.opacity = "1";
  }

  // --- Init ---

  function init() {
    if (document.getElementById("iflow-bulk-panel")) return;

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
  } else {
    init();
  }
})();
