// ==UserScript==
// @name         Old Reddit Redirect
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Redirect reddit.com to old.reddit.com
// @author       You
// @match        *://www.reddit.com/*
// @match        *://reddit.com/*
// @match        *://new.reddit.com/*
// @match        *://sh.reddit.com/*
// @exclude      *://old.reddit.com/*
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/old-reddit.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/old-reddit.js
// @grant        none
// @run-at       document-start
// ==/UserScript==
(function () {
    const url = window.location.href;
    const newUrl = url.replace(/^(https?:\/\/)(www\.|new\.|sh\.)?reddit\.com/, "$1old.reddit.com");
    if (url !== newUrl) {
        window.location.replace(newUrl);
    }
})();
