// ==UserScript==
// @name         Hide Discord Welcome Messages
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Hides system welcome/greeting messages in Discord channels
// @author       galer7
// @match        https://discord.com/*
// @match        http://discord.com/*
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/discord-hide-welcome.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/discord-hide-welcome.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
    const WELCOME_ICON_URL = "/assets/8b9de960da063cb9.svg";
    const STYLE_ID = "tm-hide-welcome-messages";
    function injectStyle() {
        if (document.getElementById(STYLE_ID))
            return;
        const style = document.createElement("style");
        style.id = STYLE_ID;
        // Target system messages that contain the welcome icon background image
        // Also hide via MutationObserver below for reliability
        style.textContent = `
      li[class*="messageListItem"]:has(div[class*="systemMessage"] div[class*="icon__"][style*="${WELCOME_ICON_URL}"]) {
        display: none !important;
      }
    `;
        document.head.appendChild(style);
    }
    // Fallback: MutationObserver to hide welcome messages that CSS :has() might miss
    function hideWelcomeMessages() {
        const icons = document.querySelectorAll(`div[class*="systemMessage"] div[class*="icon__"][style*="${WELCOME_ICON_URL}"]`);
        for (let i = 0; i < icons.length; i++) {
            const icon = icons[i];
            const listItem = icon.closest('li[class*="messageListItem"]');
            if (listItem) {
                listItem.style.display = "none";
            }
        }
    }
    injectStyle();
    hideWelcomeMessages();
    const observer = new MutationObserver(hideWelcomeMessages);
    observer.observe(document.body, { childList: true, subtree: true });
})();
