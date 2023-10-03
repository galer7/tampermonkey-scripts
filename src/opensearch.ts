// ==UserScript==
// @name         Open all logs in a log aggregating internal app
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @grant        none
// @run-at       context-menu
// ==/UserScript==

(function () {
  const trElements = document.querySelectorAll(".osd-table > tbody > tr");

  // Loop through the <tr> elements and click the first button in each
  trElements.forEach((trElement) => {
    // Find the first button element within the current <tr>
    const button = trElement.querySelector("button");

    // Check if a button was found within the current <tr> before attempting to click it
    if (button) {
      // Click the button
      button.click();
    }
  });

  const docViewers = document.querySelectorAll(".osdDocViewer");

  // press the 2nd button in each document viewer
  docViewers.forEach((docViewer) => {
    // Find the second button element within the current document viewer
    const button = docViewer.querySelectorAll("button")[1];

    // Check if a button was found within the current document viewer before attempting to click it
    if (button) {
      // Click the button
      button.click();
    }
  });

  docViewers.forEach((docViewer) => {
    // Find the code element within the current document viewer
    const codeElem = docViewer.querySelector("code");

    // Check if a code element was found within the current document viewer before attempting to click it
    if (codeElem) {
      beautifyLogMsgFromCodeElem(codeElem);
    }
  });
})();

function getCodeElements() {
  // find the tr's with only one child td
  const trElementsWithOneChild = document.querySelectorAll(
    ".osd-table > tbody > tr > td:only-child"
  );
  trElementsWithOneChild.forEach((td) => {
    // get all code elements
    const codeElements = td.querySelectorAll("code");
    console.log(codeElements);
  });
}

function beautifyLogMsgFromCodeElem(codeElem: HTMLElement) {
  const spanElements = codeElem.querySelectorAll("span");

  for (let i = 0; i < spanElements.length; i++) {
    const isLogMsg = spanElements[i].textContent
      ?.trimStart()
      .startsWith('"msg":');

    if (!isLogMsg) {
      continue;
    }

    const logMsg = spanElements[i].querySelectorAll("span")[2].textContent;
    if (!logMsg) {
      continue;
    }

    const firstBracketIndex = logMsg.indexOf("{");
    const lastBracketIndex = logMsg.lastIndexOf("}");
    const jsonString = logMsg.substring(
      firstBracketIndex,
      lastBracketIndex + 1
    );

    const newLogMsg = JSON.parse(`"${jsonString}"`);

    const reconstructedLogMsg =
      logMsg.substring(0, firstBracketIndex) +
      newLogMsg +
      logMsg.substring(lastBracketIndex + 1);

    spanElements[i].textContent = reconstructedLogMsg;
    return;
  }
}
