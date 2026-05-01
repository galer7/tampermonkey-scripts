// ==UserScript==
// @name         Autofill 8h on day page
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Auto-fill 8h attendance on hriflow day page
// @author       You
// @match        https://app.hriflow.ro/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=hriflow.ro
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/hriflow.js
// @grant        none
// ==/UserScript==

(function () {
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

  document.addEventListener("dblclick", (e) => {
    const dayCell = (e.target as HTMLElement).closest(".td-user-day");
    if (dayCell) {
      run();
    }
  });

  async function autofill() {
    const modal = await waitForElement(".modal-container .modal-body");

    // Skip if day is locked
    if (document.querySelector(".modal-container .td-is-locked input[disabled]")) {
      console.log("[hriflow autofill] Day is locked, skipping");
      return;
    }

    // Skip if already has hours filled
    const totalEl = modal.querySelector(".td-total-work-hours");
    if (totalEl && !/0h:00m/.test(totalEl.textContent || "")) {
      console.log("[hriflow autofill] Hours already filled, skipping");
      return;
    }

    // Select "Home" from location dropdown
    const locationDropdown = await waitForElement(".modal-container .td-select-with-search");
    locationDropdown.querySelector<HTMLElement>(".td-search-input")?.click();
    await wait(300);
    const locationItems = locationDropdown.querySelectorAll(".td-list .td-item");
    for (let i = 0; i < locationItems.length; i++) {
      if (locationItems[i].textContent?.trim() === "Home") {
        (locationItems[i] as HTMLElement).click();
        break;
      }
    }
    await wait(300);

    // Fill work schedule: 9-17
    const scheduleInput = await waitForElement("#td-schedule-0") as HTMLInputElement;
    scheduleInput.focus();
    scheduleInput.value = "9-17";
    scheduleInput.dispatchEvent(new Event("input", { bubbles: true }));
    scheduleInput.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(300);

    // Click Apply
    await clickAndWait(
      await waitForElement(".modal-container .td-footer-apply-button")
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
