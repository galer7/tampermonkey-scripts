// ==UserScript==
// @name         Google Services Bridge
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Bridge connector for Google Ads, GA4, Merchant Center, GSC — exposes page context via localhost:9876
// @author       galer7
// @match        https://ads.google.com/*
// @match        https://analytics.google.com/*
// @match        https://merchants.google.com/*
// @match        https://search.google.com/search-console*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/google-services.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/google-services.js
// @grant        none
// ==/UserScript==

import { initBridge } from "./lib";

(function () {
  var names: Record<string, string> = {
    "ads.google.com": "gads",
    "analytics.google.com": "ga4",
    "merchants.google.com": "gmc",
    "search.google.com": "gsc",
  };
  var name = names[location.hostname] || "google";
  initBridge(name, { version: "1.2" });
})();
