const BRIDGE_URL = "ws://localhost:9876";
const RECONNECT_INTERVAL = 5000;

let ws: WebSocket | null = null;
let scriptName = "unknown";

export function initBridge(name: string) {
  scriptName = name;
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
    send("register", { script: scriptName, url: location.href });
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

function handleCommand(msg: { type: string; id?: string; code?: string; selector?: string }) {
  switch (msg.type) {
    case "eval": {
      try {
        const result = new Function(msg.code || "")();
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
    case "ping": {
      send("pong");
      break;
    }
  }
}

export function bridgeLog(level: "info" | "warn" | "error", message: string, data?: unknown) {
  send("log", { level, message, data });
}
