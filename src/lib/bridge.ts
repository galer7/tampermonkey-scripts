const BRIDGE_URL = "ws://localhost:9876";
const RECONNECT_INTERVAL = 5000;

let ws: WebSocket | null = null;
let scriptName = "unknown";
let scriptVersion = "0";
let clientId = "";
let destroyFn: (() => void) | null = null;

function generateId(): string {
  return Math.random().toString(36).slice(2, 8);
}

// Register a TrustedTypes policy early, before the page's CSP locks it down.
// This lets eval/hotswap work on GMC, GSC, and other Trusted Types-enforcing pages.
let trustedEval: ((code: string) => Function) | null = null;
try {
  if (typeof window !== "undefined" && (window as any).trustedTypes?.createPolicy) {
    const policy = (window as any).trustedTypes.createPolicy("tm-bridge", {
      createScript: (s: string) => s,
    });
    trustedEval = (code: string) => new Function(policy.createScript(code) as unknown as string);
  }
} catch {
  // Policy already exists or TT not available — fall through to plain eval
}

function safeEval(code: string): any {
  if (trustedEval) return trustedEval(code)();
  return new Function(code)();
}

export function initBridge(name: string, opts?: { version?: string; onDestroy?: () => void } | (() => void)) {
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
    } catch {}
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

function send(type: string, data: Record<string, unknown> = {}) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, script: scriptName, ts: Date.now(), ...data }));
  }
}

function findElement(msg: { selector?: string; text?: string; role?: string }): Element | null {
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

function handleCommand(msg: { type: string; id?: string; code?: string; selector?: string; text?: string; role?: string; url?: string; extract?: string }) {
  switch (msg.type) {
    case "hotswap": {
      if (destroyFn) {
        try { destroyFn(); } catch {}
        destroyFn = null;
      }
      try {
        safeEval(msg.code || "");
        send("hotswap-result", { id: msg.id, ok: true });
      } catch (e: any) {
        send("hotswap-result", { id: msg.id, ok: false, error: e.message });
      }
      break;
    }
    case "eval": {
      try {
        const result = safeEval(msg.code || "");
        send("eval-result", { id: msg.id, ok: true, result: String(result) });
      } catch (e: any) {
        send("eval-result", { id: msg.id, ok: false, error: e.message });
      }
      break;
    }
    case "snapshot": {
      const el = document.querySelector(msg.selector || "body");
      const html = el ? el.innerHTML.slice(0, 10000) : null;
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
        (el as HTMLElement).scrollIntoView({ block: "center" });
        (el as HTMLElement).click();
        send("click-result", { id: msg.id, ok: true, clicked: el.textContent?.trim().slice(0, 80) });
      } catch (e: any) {
        send("click-result", { id: msg.id, ok: false, error: e.message });
      }
      break;
    }
    case "navigate": {
      try {
        // Use SPA-friendly navigation: find an <a> with matching href and click it,
        // or fall back to history.pushState + popstate event
        const targetUrl = msg.url || "";
        const link = document.querySelector(`a[href*="${targetUrl}"]`) as HTMLAnchorElement | null;
        if (link) {
          link.click();
          send("navigate-result", { id: msg.id, ok: true, method: "link-click", url: link.href });
        } else {
          // pushState + popstate to trigger SPA router
          history.pushState(null, "", targetUrl);
          window.dispatchEvent(new PopStateEvent("popstate"));
          send("navigate-result", { id: msg.id, ok: true, method: "pushstate", url: targetUrl });
        }
      } catch (e: any) {
        send("navigate-result", { id: msg.id, ok: false, error: e.message });
      }
      break;
    }
    case "extract": {
      // Structured data extraction without eval — works on Trusted Types pages.
      // extract spec: "text", "table", "links", "list"
      try {
        const root = document.querySelector(msg.selector || "body");
        if (!root) {
          send("extract-result", { id: msg.id, ok: false, error: "Root not found" });
          break;
        }
        let data: unknown;
        switch (msg.extract) {
          case "text":
            data = root.textContent?.trim().replace(/\s+/g, " ").slice(0, 8000);
            break;
          case "table": {
            const rows = root.querySelectorAll("tr, [role='row']");
            data = Array.from(rows).map(r => {
              const cells = r.querySelectorAll("td, th, [role='gridcell'], [role='columnheader']");
              return Array.from(cells).map(c => c.textContent?.trim().replace(/\s+/g, " ") || "");
            });
            break;
          }
          case "links": {
            const anchors = root.querySelectorAll("a[href]");
            data = Array.from(anchors).map(a => ({
              text: a.textContent?.trim().slice(0, 80),
              href: (a as HTMLAnchorElement).href,
            })).filter(l => l.text && l.text.length > 0);
            break;
          }
          case "list": {
            const items = root.querySelectorAll("li, [role='listitem'], [role='option']");
            data = Array.from(items).map(i => i.textContent?.trim().replace(/\s+/g, " ").slice(0, 200) || "");
            break;
          }
          default:
            data = root.textContent?.trim().replace(/\s+/g, " ").slice(0, 8000);
        }
        send("extract-result", { id: msg.id, ok: true, extract: msg.extract, result: JSON.stringify(data) });
      } catch (e: any) {
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

export function bridgeLog(level: "info" | "warn" | "error", message: string, data?: unknown) {
  send("log", { level, message, data });
}
