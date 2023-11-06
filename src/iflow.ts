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

(function () {
  window.onload = async function () {
    await wait(1000);

    // Open modal
    await clickAndWait(
      document.querySelector(
        "#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.row.td-user-att-header > div > div.td-add-live-att-btn-wrap > a"
      )
    );

    // Open location picker
    await clickAndWait(
      document.querySelector(
        "#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.td-user-attendance-list-wrap > div > div.td-checkin-modal > div > div > div > div.modal-body > div > form > div:nth-child(2) > div > div > div > div > div.td-select-single-button"
      )
    );

    // Pick location: Home
    await clickAndWait(
      document.querySelector(
        "#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.td-user-attendance-list-wrap > div > div.td-checkin-modal > div > div > div > div.modal-body > div > form > div:nth-child(2) > div > div > div > div > div.form-group.td-select-list > div.td-elements-list > div.td-elements-list-wrap > div:nth-child(2) > a.td-element.td-parent-element"
      )
    );

    // Open start time picker
    await clickAndWait(
      document.querySelector("[id*='td-ckeck-in-out-start-time'")
    );

    // Pick start time: 9AM
    await pickStartTime();

    // Open end time picker
    await clickAndWait(
      document.querySelector("[id*='td-ckeck-in-out-end-time'")
    );

    // Pick end time: 5PM
    await pickEndTime();

    // Submit form with click
    await clickAndWait(
      document.querySelector(
        "#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.td-user-attendance-list-wrap > div > div.td-checkin-modal > div > div > div > div.modal-footer > button"
      )
    );
  };
})();

function wait(ms: number) {
  return new Promise(function (resolve, reject) {
    setTimeout(resolve, ms);
  });
}

async function clickAndWait(element: HTMLElement | null) {
  if (!element) {
    throw new Error(`Element does not exist!`);
  }

  element.click();
  await wait(200);
}

async function pickStartTime() {
  const timePickerLists = document.querySelectorAll(".ui-timepicker-list");
  const startTimePickerList = timePickerLists[0];
  const startListItems = startTimePickerList.querySelectorAll("li");

  for (let i = 0; i < startListItems.length; i++) {
    if (startListItems[i].textContent?.includes("9:00")) {
      return await clickAndWait(startListItems[i] as HTMLElement);
    }
  }
}

async function pickEndTime() {
  const timePickerLists = document.querySelectorAll(".ui-timepicker-list");
  const endTimePickerList = timePickerLists[1];
  const endListItems = endTimePickerList.querySelectorAll("li");

  for (let i = 0; i < endListItems.length; i++) {
    if (endListItems[i].textContent?.includes("17:00")) {
      return await clickAndWait(endListItems[i] as HTMLElement);
    }
  }
}
