// ==UserScript==
// @name         Google Merchant Center Bridge
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Bridge connector for Merchant Center — exposes page context via localhost:9876
// @author       galer7
// @match        https://merchants.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=merchants.google.com
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/google-merchant.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/google-merchant.js
// @grant        none
// ==/UserScript==

import { initBridge } from "./lib";

(function () {
  initBridge("gmc");
})();
