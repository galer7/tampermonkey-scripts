// ==UserScript==
// @name         Google Analytics Bridge
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Bridge connector for GA4 — exposes page context via localhost:9876
// @author       galer7
// @match        https://analytics.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=analytics.google.com
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/google-analytics.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/google-analytics.js
// @grant        none
// ==/UserScript==

import { initBridge } from "./lib";

(function () {
  initBridge("ga4");
})();
