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

(() => {
  // src/lib/bridge.ts
  var BRIDGE_URL = "ws://localhost:9876";
  var RECONNECT_INTERVAL = 5e3;
  var ws = null;
  var scriptName = "unknown";
  var clientId = "";
  var destroyFn = null;
  function generateId() {
    return Math.random().toString(36).slice(2, 8);
  }
  function initBridge(name, onDestroy) {
    if (destroyFn) destroyFn();
    scriptName = name;
    clientId = `${name}:${generateId()}`;
    destroyFn = onDestroy || null;
    connect();
  }
  function connect() {
    try {
      ws = new WebSocket(BRIDGE_URL);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      send("register", { script: scriptName, clientId, url: location.href });
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleCommand(msg);
      } catch {
      }
    };
    ws.onclose = () => {
      ws = null;
      scheduleReconnect();
    };
    ws.onerror = () => {
      ws?.close();
    };
  }
  function scheduleReconnect() {
    setTimeout(connect, RECONNECT_INTERVAL);
  }
  function send(type, data = {}) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, script: scriptName, ts: Date.now(), ...data }));
    }
  }
  function handleCommand(msg) {
    switch (msg.type) {
      case "hotswap": {
        if (destroyFn) {
          try {
            destroyFn();
          } catch {
          }
          destroyFn = null;
        }
        try {
          const fn = new Function(msg.code || "");
          fn();
          send("hotswap-result", { id: msg.id, ok: true });
        } catch (e) {
          send("hotswap-result", { id: msg.id, ok: false, error: e.message });
        }
        break;
      }
      case "eval": {
        try {
          const result = new Function(msg.code || "")();
          send("eval-result", { id: msg.id, ok: true, result: String(result) });
        } catch (e) {
          send("eval-result", { id: msg.id, ok: false, error: e.message });
        }
        break;
      }
      case "snapshot": {
        const el = document.querySelector(msg.selector || "body");
        const html = el ? el.innerHTML.slice(0, 1e4) : null;
        send("snapshot-result", { id: msg.id, selector: msg.selector, html });
        break;
      }
      case "probe": {
        const el = document.querySelector(msg.selector || "body");
        send("probe-result", { id: msg.id, selector: msg.selector, found: !!el });
        break;
      }
      case "ping": {
        send("pong");
        break;
      }
    }
  }

  // src/google-ads.ts
  (function() {
    initBridge("gads");
  })();
})();
