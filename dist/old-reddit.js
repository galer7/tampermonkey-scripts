"use strict";
// ==UserScript==
// @name         Old Reddit Redirect
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Redirect reddit.com to old.reddit.com
// @author       You
// @match        *://www.reddit.com/*
// @match        *://reddit.com/*
// @exclude      *://old.reddit.com/*
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/old-reddit.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/old-reddit.js
// @grant        none
// @run-at       document-start
// ==/UserScript==
(function () {
    const url = window.location.href;
    const newUrl = url
        .replace("://www.reddit.com", "://old.reddit.com")
        .replace("://reddit.com", "://old.reddit.com");
    if (url !== newUrl) {
        window.location.replace(newUrl);
    }
})();
