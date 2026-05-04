// ==UserScript==
// @name         iFlow Bulk Attendance
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Bulk-fill monthly attendance from dayData view
// @author       galer7
// @match        https://app.hriflow.ro/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hriflow.ro
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @grant        none
// ==/UserScript==

import { wait, createPanel, initBridge } from "./lib";
import type { Panel } from "./lib";

declare const jQuery: any;

(function () {
  const CLOCK_IN = "9:00";
  const CLOCK_OUT = "17:00";

  type DayStatus = "fill" | "skip-weekend" | "skip-event";

  interface DayInfo {
    day: number;
    status: DayStatus;
    element: HTMLElement;
  }

  let panel: Panel;

  function getDayCells(): DayInfo[] {
    const cells = document.querySelectorAll<HTMLElement>(".td-user-schedule-data .td-user-day");
    const results: DayInfo[] = [];

    const headerCells = document.querySelectorAll<HTMLElement>(".td-week-days > div");

    cells.forEach((cell, idx) => {
      const dayNumEl = cell.querySelector(".td-day-number");
      if (!dayNumEl) return;
      const day = parseInt(dayNumEl.textContent?.trim() || "0", 10);
      if (!day) return;

      let status: DayStatus = "fill";

      const dayName = headerCells[idx]?.querySelector(".td-week-days-align")?.textContent?.trim() || "";
      if (dayName === "Sa" || dayName === "Su") {
        status = "skip-weekend";
      } else if (cell.querySelector(".td-day-has-events")) {
        status = "skip-event";
      }

      results.push({ day, status, element: cell });
    });

    return results;
  }

  function getCurrentMonthYear(): { month: string; year: string } {
    const text = document.querySelector(".td-month-date")?.textContent?.trim() || "";
    const match = text.match(/(\w+)\s+(\d{4})/);
    if (!match) {
      const now = new Date();
      return { month: String(now.getMonth() + 1).padStart(2, "0"), year: String(now.getFullYear()) };
    }
    const monthNames: Record<string, string> = {
      January: "01", February: "02", March: "03", April: "04",
      May: "05", June: "06", July: "07", August: "08",
      September: "09", October: "10", November: "11", December: "12",
      Ianuarie: "01", Februarie: "02", Martie: "03", Aprilie: "04",
      Mai: "05", Iunie: "06", Iulie: "07", August_: "08",
      Septembrie: "09", Octombrie: "10", Noiembrie: "11", Decembrie: "12",
    };
    return { month: monthNames[match[1]] || "01", year: match[2] };
  }

  function findVisibleModal(): HTMLElement | null {
    const masks = document.querySelectorAll<HTMLElement>(".modal-mask");
    for (let i = 0; i < masks.length; i++) {
      if (masks[i].style.display !== "none") {
        const container = masks[i].querySelector(".modal-container") as HTMLElement;
        if (container) return container;
      }
    }
    return null;
  }

  async function pickTime(input: HTMLInputElement, value: string): Promise<void> {
    input.focus();
    input.click();
    await wait(400);

    const wrappers = document.querySelectorAll<HTMLElement>(".ui-timepicker-wrapper");
    for (let w = 0; w < wrappers.length; w++) {
      if (wrappers[w].style.display === "none") continue;
      const items = wrappers[w].querySelectorAll<HTMLElement>("li");
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

  async function fillOneDay(day: number, month: string, year: string): Promise<boolean> {
    panel.log(`Day ${day}: opening modal...`);

    const addBtn = document.querySelector(".td-attendance-add-btn") as HTMLElement;
    if (!addBtn) throw new Error("'Add attendance' button not found");
    addBtn.click();
    await wait(800);

    const modal = findVisibleModal();
    if (!modal) throw new Error("Modal didn't open");

    const headerText = modal.querySelector(".modal-header")?.textContent || "";
    if (!headerText.replace(/\s+/g, " ").trim().toLowerCase().includes("add live attendance")) {
      const cancelBtn = modal.querySelector(".cancel-btn a, .modal-close") as HTMLElement;
      cancelBtn?.click();
      await wait(500);
      throw new Error("Wrong modal opened");
    }

    panel.log(`Day ${day}: setting date...`);
    const dateInput = modal.querySelector("input.hasDatepicker") as HTMLInputElement;
    if (!dateInput) throw new Error("Date input not found");
    dateInput.focus();
    jQuery(dateInput).datepicker("show");
    await wait(500);
    const dp = document.getElementById("ui-datepicker-div");
    if (!dp) throw new Error("Datepicker popup not found");
    const dayCells = dp.querySelectorAll<HTMLElement>("td a");
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
    const timeInputs = modal.querySelectorAll<HTMLInputElement>(".ui-timepicker-input");
    if (timeInputs.length < 2) throw new Error("Time inputs not found");
    await pickTime(timeInputs[0], CLOCK_IN);

    panel.log(`Day ${day}: clock out ${CLOCK_OUT}...`);
    await pickTime(timeInputs[1], CLOCK_OUT);
    await wait(500);

    const errorEl = modal.querySelector(".alert-danger") as HTMLElement;
    if (errorEl && errorEl.style.display !== "none") {
      const errMsg = errorEl.textContent?.trim() || "Unknown error";
      panel.log(`Day ${day}: <span style="color:#e94560">ERROR - ${errMsg}</span>`);
      const cancelBtn = modal.querySelector(".cancel-btn a") as HTMLElement;
      cancelBtn?.click();
      await wait(500);
      return false;
    }

    panel.log(`Day ${day}: submitting...`);
    const submitBtn = modal.querySelector(".modal-footer .modal-default-button") as HTMLElement;
    if (!submitBtn) throw new Error("Submit button not found");
    submitBtn.click();
    await wait(1500);

    const stillOpen = findVisibleModal();
    if (stillOpen) {
      const errorAfter = stillOpen.querySelector(".alert-danger") as HTMLElement;
      if (errorAfter && errorAfter.style.display !== "none") {
        panel.log(`Day ${day}: <span style="color:#e94560">FAILED - ${errorAfter.textContent?.trim()}</span>`);
        const cancelBtn = stillOpen.querySelector(".cancel-btn a") as HTMLElement;
        cancelBtn?.click();
        await wait(500);
        return false;
      }
    }

    panel.log(`Day ${day}: <span style="color:#0cca4a">done</span>`);
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

  function dryRun() {
    panel.clear();
    clearOverlays();
    const days = getDayCells();

    if (days.length === 0) {
      panel.log("No day cells found — are you on the dayData page?");
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
      }
    }

    const { month, year } = getCurrentMonthYear();
    panel.log(`Dry run (${month}/${year}): <strong>${toFill}</strong> to fill, ${days.length - toFill} skipped`);
    panel.log(`<em><span style="color:#0cca4a">GREEN</span>=fill <span style="color:#666">GREY</span>=weekend (Sa/Su only) <span style="color:#a3419a">PURPLE</span>=existing event</em>`);
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

    const { month, year } = getCurrentMonthYear();
    panel.log(`Filling <strong>${toFill.length}</strong> days for ${month}/${year}...`);

    const buttons = panel.element.querySelectorAll<HTMLButtonElement>("button");
    buttons.forEach((b) => { b.disabled = true; b.style.opacity = "0.5"; });

    let success = 0;
    let failed = 0;

    for (const d of toFill) {
      try {
        const ok = await fillOneDay(d.day, month, year);
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
          const cancelBtn = openModal.querySelector(".cancel-btn a, .modal-close") as HTMLElement;
          cancelBtn?.click();
          await wait(500);
        }
      }
    }

    panel.log(`<strong>Done!</strong> ${success} filled, ${failed} failed.`);
    buttons.forEach((b) => { b.disabled = false; b.style.opacity = "1"; });
  }

  // --- Init ---

  let observer: MutationObserver | null = null;

  function destroy() {
    if (panel) panel.element.remove();
    if (observer) { observer.disconnect(); observer = null; }
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
      { id: "iflow-fill", label: "Fill Month", color: "#0cca4a", onClick: fillMonth },
    ]);
  }

  initBridge("hriflow", destroy);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
