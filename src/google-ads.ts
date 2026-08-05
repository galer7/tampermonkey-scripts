// ==UserScript==
// @name         Google Ads Bridge
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Bridge connector for Google Ads — exposes page context via localhost:9876
// @author       galer7
// @match        https://ads.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=ads.google.com
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/google-ads.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/google-ads.js
// @grant        none
// ==/UserScript==

import { initBridge } from "./lib";

(function () {
  initBridge("gads");
})();
