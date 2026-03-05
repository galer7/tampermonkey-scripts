// ==UserScript==
// @name         Autofill 8h on day page
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Auto-fill 8h attendance on hriflow day page
// @author       You
// @match        https://app.hriflow.ro/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hriflow.ro
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @grant        none
// ==/UserScript==

(function () {
  let lastUrl = location.href;
  let running = false;

  async function run() {
    if (running) return;
    running = true;
    try {
      await autofill();
    } catch (e) {
      console.error("[hriflow autofill]", e);
    } finally {
      running = false;
    }
  }

  // Run on initial load
  run();

  // Re-run when URL changes (SPA navigation)
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      run();
    }
  }).observe(document.body, { childList: true, subtree: true });

  async function autofill() {
    // Wait for the attendance section to load
    const totalsEl = await waitForElement(".td-period-totals-counter");
    const totalsText = totalsEl.textContent || "";
    // If total worked hours > 0, attendance already exists — skip
    const match = totalsText.match(/Total:\s*(\d+)/);
    if (match && parseInt(match[1], 10) > 0) {
      console.log("[hriflow autofill] Attendance already exists, skipping");
      return;
    }

    // Click "Add attendance" button
    await clickAndWait(
      await waitForElement("a.td-attendance-add-btn")
    );

    // Open location picker inside checkin modal
    await clickAndWait(
      await waitForElement(".td-checkin-modal .td-select-single-button")
    );

    // Pick location: Home
    await clickAndWait(
      await waitForElement(".td-checkin-modal .td-elements-list a.td-element")
    );

    // Open start time picker
    await clickAndWait(
      await waitForElement("[id*='td-ckeck-in-out-start-time']")
    );

    // Pick start time: 9AM
    await pickStartTime();

    // Open end time picker
    await clickAndWait(
      await waitForElement("[id*='td-ckeck-in-out-end-time']")
    );

    // Pick end time: 5PM
    await pickEndTime();

    // Submit form
    await clickAndWait(
      await waitForElement(".td-checkin-modal .modal-footer .modal-default-button")
    );
  }
})();

function wait(ms: number) {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, ms);
  });
}

async function waitForElement(selector: string, timeout = 10000): Promise<HTMLElement> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.querySelector(selector);
    if (el) return el as HTMLElement;
    await wait(500);
  }
  throw new Error(`Element not found within ${timeout}ms: ${selector}`);
}

async function clickAndWait(element: HTMLElement) {
  element.click();
  await wait(200);
}

async function pickStartTime() {
  const start = Date.now();
  while (Date.now() - start < 10000) {
    const timePickerLists = document.querySelectorAll(".ui-timepicker-list");
    if (timePickerLists.length > 0) {
      const startListItems = timePickerLists[0].querySelectorAll("li");
      for (let i = 0; i < startListItems.length; i++) {
        if (startListItems[i].textContent?.includes("9:00")) {
          return await clickAndWait(startListItems[i] as HTMLElement);
        }
      }
    }
    await wait(500);
  }
  throw new Error("Start time picker not found");
}

async function pickEndTime() {
  const start = Date.now();
  while (Date.now() - start < 10000) {
    const timePickerLists = document.querySelectorAll(".ui-timepicker-list");
    if (timePickerLists.length > 1) {
      const endListItems = timePickerLists[1].querySelectorAll("li");
      for (let i = 0; i < endListItems.length; i++) {
        if (endListItems[i].textContent?.includes("17:00")) {
          return await clickAndWait(endListItems[i] as HTMLElement);
        }
      }
    }
    await wait(500);
  }
  throw new Error("End time picker not found");
}
