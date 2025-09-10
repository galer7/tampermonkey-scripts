// ==UserScript==
// @name         Element Text Copy on Click
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Highlights elements on hover and copies the text of a clicked element.
// @author       Gemini
// @match        *://*.linkedin.com/*
// @match        *://*.olx.ro/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// ==/UserScript==
(function () {
  "use strict";
  // Add styles for the highlighter and a temporary copied indicator
  GM_addStyle(`
.element-highlighter {
outline: 2px dashed #0081C9 !important;
box-shadow: 0 0 5px #0081C9 !important;
transition: all 0.1s ease-in-out;
cursor: pointer;
}
.element-highlighter.copied {
outline: 2px solid #28a745 !important;
box-shadow: 0 0 5px #28a745 !important;
}
.element-highlighter.no-text {
outline: 2px solid #dc3545 !important;
box-shadow: 0 0 5px #dc3545 !important;
}
#copy-notification {
position: fixed;
bottom: 20px;
left: 50%;
transform: translateX(-50%);
background-color: rgba(0, 0, 0, 0.7);
color: white;
padding: 10px 20px;
border-radius: 5px;
z-index: 99999;
font-family: sans-serif;
opacity: 0;
transition: opacity 0.5s ease-in-out;
}
`);
  let highlightedElement = null;
  let copyTimeout = null;
  let notificationElement = null;
  // Create the notification element once
  function createNotificationElement() {
    if (notificationElement) return;
    notificationElement = document.createElement("div");
    notificationElement.id = "copy-notification";
    document.body.appendChild(notificationElement);
  }
  // Show the notification with a given message
  function showNotification(message) {
    if (!notificationElement) createNotificationElement();
    notificationElement.textContent = message;
    notificationElement.style.opacity = "1";
    setTimeout(() => {
      notificationElement.style.opacity = "0";
    }, 1500);
  }
  // Listen for mouseover events to apply the highlight
  document.addEventListener("mouseover", (event) => {
    // Remove highlight from the previously highlighted element
    if (highlightedElement) {
      highlightedElement.classList.remove(
        "element-highlighter",
        "copied",
        "no-text"
      );
    }
    const targetElement = event.target;
    if (targetElement) {
      targetElement.classList.add("element-highlighter");
      highlightedElement = targetElement;
    }
  });
  // Listen for mouseout events to remove the highlight
  document.addEventListener("mouseout", (event) => {
    // Only remove the highlight if the mouse is moving off the element
    if (highlightedElement && event.target === highlightedElement) {
      highlightedElement.classList.remove(
        "element-highlighter",
        "copied",
        "no-text"
      );
      highlightedElement = null;
    }
  });
  // Listen for click events to copy the text
  document.addEventListener(
    "click",
    (event) => {
      try {
        const targetElement = event.target;
        if (targetElement) {
          const textToCopy = targetElement.textContent
            .split("\n")
            .filter((s) => !!s.trim())
            .join("");
          if (textToCopy) {
            GM_setClipboard(textToCopy, "text");
            showNotification("Text copied!");
            // Provide visual feedback
            targetElement.classList.add("copied");
            if (copyTimeout) clearTimeout(copyTimeout);
            copyTimeout = setTimeout(() => {
              targetElement.classList.remove("copied");
            }, 1500);
          } else {
            showNotification("No text found.");
            targetElement.classList.add("no-text");
            if (copyTimeout) clearTimeout(copyTimeout);
            copyTimeout = setTimeout(() => {
              targetElement.classList.remove("no-text");
            }, 1500);
          }
        }
      } catch (error) {
        console.error("An error occurred during text copy:", error);
        showNotification("Error: Could not copy text.");
      }
    },
    true
  ); // Using the capturing phase to run before other handlers
})();
