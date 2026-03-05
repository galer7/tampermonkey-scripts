// ==UserScript==
// @name         Autofill 8h on day page
// @namespace    http://tampermonkey.net/
// @version      0.3
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
    let lastUrl = location.href;
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
    // Run on initial load
    run();
    // Re-run when URL changes (SPA navigation)
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            run();
        }
    }).observe(document.body, { childList: true, subtree: true });
    function autofill() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Wait for the attendance section to load
            const totalsEl = yield waitForElement(".td-period-totals-counter");
            const totalsText = totalsEl.textContent || "";
            // If total worked hours > 0, attendance already exists — skip
            const match = totalsText.match(/Total:\s*(\d+)/);
            if (match && parseInt(match[1], 10) > 0) {
                console.log("[hriflow autofill] Attendance already exists, skipping");
                return;
            }
            // Skip if day has "Liber Colaborator" event
            const eventWraps = document.querySelectorAll(".td-events-big-wrap .td-events-list-day-data-view");
            for (let i = 0; i < eventWraps.length; i++) {
                if ((_a = eventWraps[i].textContent) === null || _a === void 0 ? void 0 : _a.includes("Liber Colaborator")) {
                    console.log("[hriflow autofill] Liber Colaborator event found, skipping");
                    return;
                }
            }
            // Click "Add attendance" button
            yield clickAndWait(yield waitForElement("a.td-attendance-add-btn"));
            // Open location picker inside checkin modal
            yield clickAndWait(yield waitForElement(".td-checkin-modal .td-select-single-button"));
            // Pick location: Home
            yield clickAndWait(yield waitForElement(".td-checkin-modal .td-elements-list a.td-element"));
            // Open start time picker
            yield clickAndWait(yield waitForElement("[id*='td-ckeck-in-out-start-time']"));
            // Pick start time: 9AM
            yield pickStartTime();
            // Open end time picker
            yield clickAndWait(yield waitForElement("[id*='td-ckeck-in-out-end-time']"));
            // Pick end time: 5PM
            yield pickEndTime();
            // Submit form
            yield clickAndWait(yield waitForElement(".td-checkin-modal .modal-footer .modal-default-button"));
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
function pickStartTime() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const start = Date.now();
        while (Date.now() - start < 10000) {
            const timePickerLists = document.querySelectorAll(".ui-timepicker-list");
            if (timePickerLists.length > 0) {
                const startListItems = timePickerLists[0].querySelectorAll("li");
                for (let i = 0; i < startListItems.length; i++) {
                    if ((_a = startListItems[i].textContent) === null || _a === void 0 ? void 0 : _a.includes("9:00")) {
                        return yield clickAndWait(startListItems[i]);
                    }
                }
            }
            yield wait(500);
        }
        throw new Error("Start time picker not found");
    });
}
function pickEndTime() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const start = Date.now();
        while (Date.now() - start < 10000) {
            const timePickerLists = document.querySelectorAll(".ui-timepicker-list");
            if (timePickerLists.length > 1) {
                const endListItems = timePickerLists[1].querySelectorAll("li");
                for (let i = 0; i < endListItems.length; i++) {
                    if ((_a = endListItems[i].textContent) === null || _a === void 0 ? void 0 : _a.includes("17:00")) {
                        return yield clickAndWait(endListItems[i]);
                    }
                }
            }
            yield wait(500);
        }
        throw new Error("End time picker not found");
    });
}
