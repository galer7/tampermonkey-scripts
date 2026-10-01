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

import { wait, createPanel, initBridge } from "./lib";
import type { Panel } from "./lib";

declare const jQuery: any;

(function () {
  const CLOCK_IN = "9:00:00";
  const CLOCK_OUT = "17:00:00";

  type DayStatus = "fill" | "skip-weekend" | "skip-event" | "skip-filled";

  interface DayInfo {
    day: number;
    status: DayStatus;
    element: HTMLElement;
  }

  let panel: Panel;

  // The calendar never marks days that already have attendance (.td-day-has-events is leave only),
  // so ask the API that backs the attendance list which days hold an interval.
  async function fetchFilledDays(month: string, year: string): Promise<Set<number>> {
    const user = (document.querySelector("#app") as any)?.__vue__?.$store?.state?.user;
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
      "api_auth[is_mobile_app]": "false",
    });
    const res = await fetch("/api/live_attendance/get_attendance_intervals", { method: "POST", body, credentials: "include" });
    const days: { date: string; intervals: unknown[] }[] = (await res.json()).api_reply?.attendance_days;
    if (!Array.isArray(days)) throw new Error("Unexpected attendance API reply");
    return new Set(days.filter((d) => d.intervals.length > 0).map((d) => parseInt(d.date, 10)));
  }

  function getDayCells(filled: Set<number>): DayInfo[] {
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
      } else if (filled.has(day)) {
        status = "skip-filled";
      }

      results.push({ day, status, element: cell });
    });

    return results;
  }

  function getCurrentMonthYear(): { month: string; year: string } {
    const fromHash = location.hash.match(/dayData\/\d+\/(\d{2})\/(\d{4})/);
    if (fromHash) return { month: fromHash[1], year: fromHash[2] };
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

    // Wait for the save to close the modal; opening the next one early is what dropped days.
    for (let i = 0; i < 40 && findVisibleModal(); i++) {
      const errorAfter = findVisibleModal()?.querySelector(".alert-danger") as HTMLElement;
      if (errorAfter && errorAfter.style.display !== "none" && errorAfter.textContent?.trim()) break;
      await wait(250);
    }

    const stillOpen = findVisibleModal();
    if (stillOpen) {
      const errorAfter = stillOpen.querySelector(".alert-danger") as HTMLElement;
      const errMsg = errorAfter && errorAfter.style.display !== "none" ? errorAfter.textContent?.trim() : "";
      panel.log(`Day ${day}: <span style="color:#e94560">FAILED - ${errMsg || "modal still open after 10s"}</span>`);
      const cancelBtn = stillOpen.querySelector(".cancel-btn a, .modal-close") as HTMLElement;
      cancelBtn?.click();
      await wait(500);
      return false;
    }
    await wait(500);

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

  async function dryRun() {
    panel.clear();
    clearOverlays();
    const { month, year } = getCurrentMonthYear();
    let filled: Set<number>;
    try {
      filled = await fetchFilledDays(month, year);
    } catch (e: unknown) {
      panel.logError(e);
      return;
    }
    const days = getDayCells(filled);

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

    const buttons = panel.element.querySelectorAll<HTMLButtonElement>("button");
    buttons.forEach((b) => { b.disabled = true; b.style.opacity = "0.5"; });

    try {
      // Pass 2 retries whatever pass 1 left without an interval.
      for (let pass = 1; pass <= 2; pass++) {
        const toFill = getDayCells(await fetchFilledDays(month, year)).filter((d) => d.status === "fill");
        if (toFill.length === 0) {
          if (pass === 1) panel.log("Nothing to fill — every workday already has attendance or an event.");
          break;
        }
        panel.log(`Pass ${pass}: filling <strong>${toFill.length}</strong> days for ${month}/${year}...`);

        for (const d of toFill) {
          try {
            await fillOneDay(d.day, month, year);
          } catch (e: unknown) {
            panel.logError(e);
            const openModal = findVisibleModal();
            if (openModal) {
              const cancelBtn = openModal.querySelector(".cancel-btn a, .modal-close") as HTMLElement;
              cancelBtn?.click();
              await wait(500);
            }
          }
        }
      }

      // The API is the record of truth: report what it holds, not what the modal claimed.
      const days = getDayCells(await fetchFilledDays(month, year));
      const missing = days.filter((d) => d.status === "fill");
      days.forEach((d) => {
        if (d.status === "skip-filled") addOverlay(d.element, "rgba(12, 202, 74, 0.6)", "OK");
      });
      missing.forEach((d) => addOverlay(d.element, "rgba(233, 69, 96, 0.6)", "ERR"));
      const filledCount = days.filter((d) => d.status === "skip-filled").length;
      panel.log(missing.length === 0
        ? `<strong>Done!</strong> ${filledCount} workdays filled (${filledCount * 8}h).`
        : `<strong>Done with gaps.</strong> Still missing: ${missing.map((d) => d.day).join(", ")}`);
    } catch (e: unknown) {
      panel.logError(e);
    } finally {
      buttons.forEach((b) => { b.disabled = false; b.style.opacity = "1"; });
    }
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
