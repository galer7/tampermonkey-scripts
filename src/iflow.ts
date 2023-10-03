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
  function wait(ms: number) {
    return new Promise(function (resolve, reject) {
      setTimeout(resolve, ms);
    });
  }

  async function tsClick(element: HTMLElement | null) {
    if (!element) throw new Error(`Element does not exist!`);
    element.click();
    await wait(200);
  }

  window.onload = async function () {
    await wait(1000);

    // Open modal
    await tsClick(
      document.querySelector(
        "#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.row.td-user-att-header > div > div.td-add-live-att-btn-wrap > a"
      )
    );

    // Open location picker
    await tsClick(
      document.querySelector(
        "#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.td-user-attendance-list-wrap > div > div.td-checkin-modal > div > div > div > div.modal-body > div > form > div:nth-child(2) > div > div > div > div > div.td-select-single-button"
      )
    );

    // Pick location: Home
    await tsClick(
      document.querySelector(
        "#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.td-user-attendance-list-wrap > div > div.td-checkin-modal > div > div > div > div.modal-body > div > form > div:nth-child(2) > div > div > div > div > div.form-group.td-select-list > div.td-elements-list > div.td-elements-list-wrap > div:nth-child(2) > a.td-element.td-parent-element"
      )
    );

    // Open start time picker
    await tsClick(document.querySelector("#td-start-time"));

    // Pick start time: 9AM
    await tsClick(
      document.querySelector(
        "body > div.ui-timepicker-wrapper.shepherd-target > ul > li:nth-child(19)"
      )
    );

    // Open end time picker
    await tsClick(document.querySelector("#td-end-time"));

    // Pick end time: 5PM
    await tsClick(
      document.querySelector("body > div:nth-child(12) > ul > li:nth-child(35)")
    );

    // Submit form with click
    await tsClick(
      document.querySelector(
        "#app > div.td-router-view > div > div > div.col-md-10.td-user-page-main > div.td-user-day-data > div:nth-child(3) > div > div > div.td-user-attendance-list-wrap > div > div.td-checkin-modal > div > div > div > div.modal-footer > button"
      )
    );
  };
})();
