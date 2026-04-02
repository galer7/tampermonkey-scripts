// ==UserScript==
// @name         Hide Discord Welcome Messages
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Hides system welcome/greeting messages in Discord channels
// @author       galer7
// @match        https://discord.com/*
// @match        http://discord.com/*
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/discord-hide-welcome.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/discord-hide-welcome.js
// @grant        none
// @run-at       document-start
// ==/UserScript==
(function () {
    const WELCOME_ICON_URL = "/assets/8b9de960da063cb9.svg";
    const style = document.createElement("style");
    style.id = "tm-hide-welcome-messages";
    style.textContent = `
    li[class*="messageListItem"]:has(div[class*="systemMessage"] div[class*="icon__"][style*="${WELCOME_ICON_URL}"]) {
      display: none !important;
    }
  `;
    (document.head || document.documentElement).appendChild(style);
})();
