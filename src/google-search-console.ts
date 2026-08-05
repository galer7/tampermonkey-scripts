// ==UserScript==
// @name         Google Search Console Bridge
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Bridge connector for GSC — exposes page context via localhost:9876
// @author       galer7
// @match        https://search.google.com/search-console/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=search.google.com
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/google-search-console.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/google-search-console.js
// @grant        none
// ==/UserScript==

import { initBridge } from "./lib";

(function () {
  initBridge("gsc");
})();
