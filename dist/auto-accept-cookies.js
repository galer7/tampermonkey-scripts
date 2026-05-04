// ==UserScript==
// @name         Auto Accept Cookies
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Automatically dismiss cookie consent banners
// @author       You
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/auto-accept-cookies.js
// @downloadURL  https://raw.githubusercontent.com/galer7/tampermonkey-scripts/master/dist/auto-accept-cookies.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
  // src/auto-accept-cookies.ts
  (function() {
    const BUTTON_SELECTORS = [
      // Common cookie consent button selectors
      '[id*="accept" i][id*="cookie" i]',
      '[id*="cookie" i][id*="accept" i]',
      '[class*="accept" i][class*="cookie" i]',
      '[class*="cookie" i][class*="accept" i]',
      '[aria-label*="accept" i][aria-label*="cookie" i]',
      '[aria-label*="accept all" i]',
      '[data-testid*="accept" i]',
      // CookieBot
      "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
      "#CybotCookiebotDialogBodyButtonAccept",
      // OneTrust
      "#onetrust-accept-btn-handler",
      // Quantcast / CMP
      '.qc-cmp2-summary-buttons button[mode="primary"]',
      // Cookielaw
      ".cookielaw-accept",
      // Generic patterns
      'button[class*="consent" i][class*="accept" i]',
      'button[class*="agree" i]',
      'a[class*="agree" i]',
      // GDPR banners
      ".gdpr-accept",
      '[data-gdpr="accept"]',
      // Common button text matches via aria/title
      '[title*="Accept all" i]',
      '[title*="Accept cookies" i]'
    ];
    const BANNER_SELECTORS = [
      "#cookie-banner",
      "#cookie-consent",
      "#cookiebanner",
      ".cookie-banner",
      ".cookie-consent",
      '[class*="cookie-banner" i]',
      '[class*="cookie-consent" i]',
      '[class*="cookie-notice" i]',
      '[id*="cookie-banner" i]',
      '[id*="cookie-consent" i]',
      '[id*="cookie-notice" i]',
      "#CybotCookiebotDialog",
      "#onetrust-banner-sdk",
      ".qc-cmp2-container"
    ];
    function clickAcceptButton() {
      for (const selector of BUTTON_SELECTORS) {
        const btn = document.querySelector(selector);
        if (btn && btn.offsetParent !== null) {
          btn.click();
          console.log("[auto-accept-cookies] Clicked:", selector);
          return true;
        }
      }
      const buttons = document.querySelectorAll(
        'button, a[role="button"], a.btn, input[type="submit"]'
      );
      const acceptPatterns = /^(accept( all)?|agree|allow( all)?|got it|ok|i agree|consent|allow cookies|accept cookies)$/i;
      for (let i = 0; i < buttons.length; i++) {
        const btn = buttons[i];
        const text = btn.textContent?.trim() || "";
        if (acceptPatterns.test(text) && btn.offsetParent !== null) {
          btn.click();
          console.log("[auto-accept-cookies] Clicked button with text:", text);
          return true;
        }
      }
      return false;
    }
    function removeBanner() {
      for (const selector of BANNER_SELECTORS) {
        const banner = document.querySelector(selector);
        if (banner) {
          banner.remove();
          console.log("[auto-accept-cookies] Removed banner:", selector);
        }
      }
    }
    function removeOverlay() {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.classList.remove(
        "cookie-modal-open",
        "no-scroll",
        "modal-open"
      );
    }
    function run() {
      const clicked = clickAcceptButton();
      if (!clicked) {
        removeBanner();
      }
      removeOverlay();
    }
    setTimeout(run, 1e3);
    setTimeout(run, 3e3);
  })();
})();
