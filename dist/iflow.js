"use strict";
// ==UserScript==
// @name         Autofill 8h on day page
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://app.iflow.ro/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=iflow.ro
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
    window.onload = function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield wait(1000);
            // Open modal
            yield clickAndWait(document.querySelector("#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.row.td-user-att-header > div > div.td-add-live-att-btn-wrap > a"));
            // Open location picker
            yield clickAndWait(document.querySelector("#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.td-user-attendance-list-wrap > div > div.td-checkin-modal > div > div > div > div.modal-body > div > form > div:nth-child(2) > div > div > div > div > div.td-select-single-button"));
            // Pick location: Home
            yield clickAndWait(document.querySelector("#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.td-user-attendance-list-wrap > div > div.td-checkin-modal > div > div > div > div.modal-body > div > form > div:nth-child(2) > div > div > div > div > div.form-group.td-select-list > div.td-elements-list > div.td-elements-list-wrap > div:nth-child(2) > a.td-element.td-parent-element"));
            // Open start time picker
            yield clickAndWait(document.querySelector("[id*='td-ckeck-in-out-start-time'"));
            // Pick start time: 9AM
            yield pickStartTime();
            // Open end time picker
            yield clickAndWait(document.querySelector("[id*='td-ckeck-in-out-end-time'"));
            // Pick end time: 5PM
            yield pickEndTime();
            // Submit form with click
            yield clickAndWait(document.querySelector("#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.td-user-attendance-list-wrap > div > div.td-checkin-modal > div > div > div > div.modal-footer > button"));
        });
    };
})();
function wait(ms) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, ms);
    });
}
function clickAndWait(element) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!element) {
            throw new Error(`Element does not exist!`);
        }
        element.click();
        yield wait(200);
    });
}
function pickStartTime() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const timePickerLists = document.querySelectorAll(".ui-timepicker-list");
        const startTimePickerList = timePickerLists[0];
        const startListItems = startTimePickerList.querySelectorAll("li");
        for (let i = 0; i < startListItems.length; i++) {
            if ((_a = startListItems[i].textContent) === null || _a === void 0 ? void 0 : _a.includes("9:00")) {
                return yield clickAndWait(startListItems[i]);
            }
        }
    });
}
function pickEndTime() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const timePickerLists = document.querySelectorAll(".ui-timepicker-list");
        const endTimePickerList = timePickerLists[1];
        const endListItems = endTimePickerList.querySelectorAll("li");
        for (let i = 0; i < endListItems.length; i++) {
            if ((_a = endListItems[i].textContent) === null || _a === void 0 ? void 0 : _a.includes("17:00")) {
                return yield clickAndWait(endListItems[i]);
            }
        }
    });
}
