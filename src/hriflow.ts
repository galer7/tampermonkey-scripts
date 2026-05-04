// ==UserScript==
// @name         iFlow Bulk Attendance
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Bulk-fill monthly attendance via "Add live attendance" modal
// @author       galer7
// @match        https://app.hriflow.ro/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hriflow.ro
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @grant        none
// ==/UserScript==

import { wait, waitForElement, setInputValue, createPanel, probeAll, logProbeResults } from "./lib";
import type { Panel } from "./lib";

(function () {
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
    monthDisplay: ".td-month-year-select .td-display-date",
  };

  type DayStatus = "fill" | "skip-weekend" | "skip-holiday" | "skip-event";

  interface DayInfo {
    day: number;
    status: DayStatus;
    element: HTMLElement;
  }

  let panel: Panel;

  function getDayCells(): DayInfo[] {
    const cells = document.querySelectorAll<HTMLElement>(SELECTORS.dayCells);
    const results: DayInfo[] = [];

    cells.forEach((cell) => {
      const dayNumEl = cell.querySelector(SELECTORS.dayNumber);
      if (!dayNumEl) return;
      const day = parseInt(dayNumEl.textContent?.trim() || "0", 10);
      if (!day) return;

      let status: DayStatus = "fill";

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

  function getDateForDay(day: number): string {
    const monthYearText = document.querySelector(SELECTORS.monthDisplay)?.textContent?.trim() || "";
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

  function findVisibleModal(): HTMLElement | null {
    const masks = document.querySelectorAll<HTMLElement>(SELECTORS.modalMask);
    for (let i = 0; i < masks.length; i++) {
      if (masks[i].style.display !== "none") {
        const container = masks[i].querySelector(SELECTORS.modalContainer) as HTMLElement;
        if (container) return container;
      }
    }
    return null;
  }

  async function waitForVisibleModal(timeout = 10000): Promise<HTMLElement> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const modal = findVisibleModal();
      if (modal) return modal;
      await wait(200);
    }
    throw new Error("No visible modal found");
  }

  async function selectLocation(modal: HTMLElement) {
    const selectWrap = modal.querySelector(SELECTORS.locationSelect) as HTMLElement;
    if (!selectWrap) throw new Error("Location dropdown not found");

    const currentName = selectWrap.querySelector(SELECTORS.locationName)?.textContent?.trim();
    if (currentName === LOCATION) return;

    selectWrap.click();
    await wait(500);

    const listWrap = await waitForElement(SELECTORS.locationList, selectWrap, 5000);
    const searchInput = listWrap.querySelector(SELECTORS.locationSearch) as HTMLInputElement;
    if (searchInput) {
      setInputValue(searchInput, LOCATION);
      await wait(500);
    }

    const items = listWrap.querySelectorAll<HTMLElement>(SELECTORS.locationItems);
    for (let i = 0; i < items.length; i++) {
      if (items[i].textContent?.trim().includes(LOCATION)) {
        items[i].click();
        await wait(300);
        return;
      }
    }
    throw new Error(`Location "${LOCATION}" not found in dropdown`);
  }

  async function selectTimepickerValue(input: HTMLInputElement, value: string) {
    input.focus();
    input.click();
    await wait(400);

    const wrappers = document.querySelectorAll<HTMLElement>(SELECTORS.timepickerWrapper);
    for (let w = 0; w < wrappers.length; w++) {
      const wrapper = wrappers[w];
      if (wrapper.style.display === "none") continue;
      const items = wrapper.querySelectorAll<HTMLElement>("li");
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

  async function fillOneDay(day: number): Promise<boolean> {
    panel.log(`Day ${day}: opening modal...`);

    const addBtn = document.querySelector(SELECTORS.addBtn) as HTMLElement;
    if (!addBtn) throw new Error("'Add attendance' button not found");
    addBtn.click();
    await wait(800);

    const modal = await waitForVisibleModal();
    const headerText = modal.querySelector(SELECTORS.modalHeader)?.textContent || "";
    if (!headerText.replace(/\s+/g, " ").trim().toLowerCase().includes("add live attendance")) {
      const cancelBtn = modal.querySelector(`${SELECTORS.cancelBtn}, .modal-close`) as HTMLElement;
      cancelBtn?.click();
      await wait(500);
      throw new Error("Wrong modal opened");
    }

    panel.log(`Day ${day}: selecting location...`);
    await selectLocation(modal);

    panel.log(`Day ${day}: setting date...`);
    const dateInput = modal.querySelector(SELECTORS.dateInput) as HTMLInputElement;
    if (!dateInput) throw new Error("Date input not found");
    setInputValue(dateInput, getDateForDay(day));
    await wait(300);

    panel.log(`Day ${day}: setting clock in ${CLOCK_IN}...`);
    const timeInputs = modal.querySelectorAll<HTMLInputElement>(SELECTORS.timeInput);
    if (timeInputs.length < 2) throw new Error("Time inputs not found");
    await selectTimepickerValue(timeInputs[0], CLOCK_IN);

    panel.log(`Day ${day}: setting clock out ${CLOCK_OUT}...`);
    await selectTimepickerValue(timeInputs[1], CLOCK_OUT);
    await wait(500);

    const errorEl = modal.querySelector(SELECTORS.alertDanger) as HTMLElement;
    if (errorEl && errorEl.style.display !== "none") {
      const errMsg = errorEl.textContent?.trim() || "Unknown error";
      panel.log(`Day ${day}: ERROR - ${errMsg}`);
      const cancelBtn = modal.querySelector(SELECTORS.cancelBtn) as HTMLElement;
      cancelBtn?.click();
      await wait(500);
      return false;
    }

    panel.log(`Day ${day}: submitting...`);
    const submitBtn = modal.querySelector(SELECTORS.submitBtn) as HTMLElement;
    if (!submitBtn) throw new Error("Submit button not found");
    submitBtn.click();
    await wait(DELAY_MS);

    const stillOpen = findVisibleModal();
    if (stillOpen) {
      const errorAfter = stillOpen.querySelector(SELECTORS.alertDanger) as HTMLElement;
      if (errorAfter && errorAfter.style.display !== "none") {
        panel.log(`Day ${day}: FAILED - ${errorAfter.textContent?.trim()}`);
        const cancelBtn = stillOpen.querySelector(SELECTORS.cancelBtn) as HTMLElement;
        cancelBtn?.click();
        await wait(500);
        return false;
      }
    }

    panel.log(`Day ${day}: done`);
    return true;
  }

  // --- Overlays ---

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

  // --- Actions ---

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
      panel.log("Nothing to fill — all days are weekends, holidays, or already have events.");
      return;
    }

    panel.log(`Starting fill for <strong>${toFill.length}</strong> days...`);

    const buttons = panel.element.querySelectorAll<HTMLButtonElement>("button");
    buttons.forEach((b) => { b.disabled = true; b.style.opacity = "0.5"; });

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
      } catch (e: unknown) {
        failed++;
        panel.logError(e);
        addOverlay(d.element, "rgba(233, 69, 96, 0.6)", "ERR");
        const openModal = findVisibleModal();
        if (openModal) {
          const cancelBtn = openModal.querySelector(`${SELECTORS.cancelBtn}, .modal-close`) as HTMLElement;
          cancelBtn?.click();
          await wait(500);
        }
      }
    }

    panel.log(`<strong>Done!</strong> ${success} filled, ${failed} failed.`);
    buttons.forEach((b) => { b.disabled = false; b.style.opacity = "1"; });
  }

  // --- Init ---

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
      { id: "iflow-fill", label: "Fill Month", color: "#0cca4a", onClick: fillMonth },
    ]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
