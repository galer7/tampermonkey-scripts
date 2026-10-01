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

(() => {
  // src/lib/bridge.ts
  var BRIDGE_URL = "ws://localhost:9876";
  var RECONNECT_INTERVAL = 5e3;
  var ws = null;
  var scriptName = "unknown";
  var scriptVersion = "0";
  var clientId = "";
  var destroyFn = null;
  function generateId() {
    return Math.random().toString(36).slice(2, 8);
  }
  var trustedEval = null;
  try {
    if (typeof window !== "undefined" && window.trustedTypes?.createPolicy) {
      const policy = window.trustedTypes.createPolicy("tm-bridge", {
        createScript: (s) => s
      });
      trustedEval = (code) => new Function(policy.createScript(code));
    }
  } catch {
  }
  function safeEval(code) {
    if (trustedEval) return trustedEval(code)();
    return new Function(code)();
  }
  function initBridge(name, opts) {
    if (destroyFn) destroyFn();
    scriptName = name;
    clientId = `${name}:${generateId()}`;
    if (typeof opts === "function") {
      destroyFn = opts;
    } else if (opts) {
      scriptVersion = opts.version || "0";
      destroyFn = opts.onDestroy || null;
    }
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
      send("register", { script: scriptName, clientId, version: scriptVersion, url: location.href });
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
  function findElement(msg) {
    if (msg.selector) {
      return document.querySelector(msg.selector);
    }
    if (msg.text) {
      const candidates = document.querySelectorAll(
        msg.role ? `[role="${msg.role}"]` : "a, button, [role='tab'], [role='link'], [role='menuitem'], [role='button']"
      );
      const needle = msg.text.toLowerCase();
      for (let i = 0; i < candidates.length; i++) {
        if (candidates[i].textContent?.trim().toLowerCase().includes(needle)) return candidates[i];
      }
    }
    return null;
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
          safeEval(msg.code || "");
          send("hotswap-result", { id: msg.id, ok: true });
        } catch (e) {
          send("hotswap-result", { id: msg.id, ok: false, error: e.message });
        }
        break;
      }
      case "eval": {
        try {
          const result = safeEval(msg.code || "");
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
      case "click": {
        const el = findElement(msg);
        if (!el) {
          send("click-result", { id: msg.id, ok: false, error: "Element not found" });
          break;
        }
        try {
          el.scrollIntoView({ block: "center" });
          el.click();
          send("click-result", { id: msg.id, ok: true, clicked: el.textContent?.trim().slice(0, 80) });
        } catch (e) {
          send("click-result", { id: msg.id, ok: false, error: e.message });
        }
        break;
      }
      case "navigate": {
        try {
          const targetUrl = msg.url || "";
          const link = document.querySelector(`a[href*="${targetUrl}"]`);
          if (link) {
            link.click();
            send("navigate-result", { id: msg.id, ok: true, method: "link-click", url: link.href });
          } else {
            history.pushState(null, "", targetUrl);
            window.dispatchEvent(new PopStateEvent("popstate"));
            send("navigate-result", { id: msg.id, ok: true, method: "pushstate", url: targetUrl });
          }
        } catch (e) {
          send("navigate-result", { id: msg.id, ok: false, error: e.message });
        }
        break;
      }
      case "extract": {
        try {
          const root = document.querySelector(msg.selector || "body");
          if (!root) {
            send("extract-result", { id: msg.id, ok: false, error: "Root not found" });
            break;
          }
          let data;
          switch (msg.extract) {
            case "text":
              data = root.textContent?.trim().replace(/\s+/g, " ").slice(0, 8e3);
              break;
            case "table": {
              const rows = root.querySelectorAll("tr, [role='row']");
              data = Array.from(rows).map((r) => {
                const cells = r.querySelectorAll("td, th, [role='gridcell'], [role='columnheader']");
                return Array.from(cells).map((c) => c.textContent?.trim().replace(/\s+/g, " ") || "");
              });
              break;
            }
            case "links": {
              const anchors = root.querySelectorAll("a[href]");
              data = Array.from(anchors).map((a) => ({
                text: a.textContent?.trim().slice(0, 80),
                href: a.href
              })).filter((l) => l.text && l.text.length > 0);
              break;
            }
            case "list": {
              const items = root.querySelectorAll("li, [role='listitem'], [role='option']");
              data = Array.from(items).map((i) => i.textContent?.trim().replace(/\s+/g, " ").slice(0, 200) || "");
              break;
            }
            default:
              data = root.textContent?.trim().replace(/\s+/g, " ").slice(0, 8e3);
          }
          send("extract-result", { id: msg.id, ok: true, extract: msg.extract, result: JSON.stringify(data) });
        } catch (e) {
          send("extract-result", { id: msg.id, ok: false, error: e.message });
        }
        break;
      }
      case "ping": {
        send("pong");
        break;
      }
    }
  }

  // src/google-services.ts
  (function() {
    var names = {
      "ads.google.com": "gads",
      "analytics.google.com": "ga4",
      "merchants.google.com": "gmc",
      "search.google.com": "gsc"
    };
    var name = names[location.hostname] || "google";
    initBridge(name, { version: "1.2" });
  })();
})();
