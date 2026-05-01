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
    let running = false;
    function run() {
        return __awaiter(this, void 0, void 0, function* () {
            if (running)
                return;
            running = true;
            try {
                yield autofill();
            }
            catch (e) {
                console.error("[hriflow autofill]", e);
            }
            finally {
                running = false;
            }
        });
    }
    document.addEventListener("dblclick", (e) => {
        const dayCell = e.target.closest(".td-user-day");
        if (dayCell) {
            run();
        }
    });
    function autofill() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const modal = yield waitForElement(".modal-container .modal-body");
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
            const locationDropdown = yield waitForElement(".modal-container .td-select-with-search");
            (_a = locationDropdown.querySelector(".td-search-input")) === null || _a === void 0 ? void 0 : _a.click();
            yield wait(300);
            const locationItems = locationDropdown.querySelectorAll(".td-list .td-item");
            for (let i = 0; i < locationItems.length; i++) {
                if (((_b = locationItems[i].textContent) === null || _b === void 0 ? void 0 : _b.trim()) === "Home") {
                    locationItems[i].click();
                    break;
                }
            }
            yield wait(300);
            // Fill work schedule: 9-17
            const scheduleInput = yield waitForElement("#td-schedule-0");
            scheduleInput.focus();
            scheduleInput.value = "9-17";
            scheduleInput.dispatchEvent(new Event("input", { bubbles: true }));
            scheduleInput.dispatchEvent(new Event("change", { bubbles: true }));
            yield wait(300);
            // Click Apply
            yield clickAndWait(yield waitForElement(".modal-container .td-footer-apply-button"));
        });
    }
})();
function wait(ms) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, ms);
    });
}
function waitForElement(selector_1) {
    return __awaiter(this, arguments, void 0, function* (selector, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.querySelector(selector);
            if (el)
                return el;
            yield wait(500);
        }
        throw new Error(`Element not found within ${timeout}ms: ${selector}`);
    });
}
function clickAndWait(element) {
    return __awaiter(this, void 0, void 0, function* () {
        element.click();
        yield wait(200);
    });
}
