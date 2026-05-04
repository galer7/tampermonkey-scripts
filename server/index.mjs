import { WebSocketServer } from "ws";
import { createServer } from "http";

const PORT = 9876;
const clients = new Map(); // scriptName -> ws
let pendingRequests = new Map(); // id -> { resolve, timer }
let requestId = 0;

const httpServer = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (url.pathname === "/clients") {
    const list = [];
    for (const [name, ws] of clients) {
      list.push({ script: name, url: ws._url, connected: ws.readyState === 1 });
    }
    res.end(JSON.stringify(list, null, 2));
    return;
  }

  if (url.pathname === "/eval") {
    const script = url.searchParams.get("script");
    const code = url.searchParams.get("code");
    if (!script || !code) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Need ?script=...&code=..." }));
      return;
    }
    sendCommand(script, "eval", { code })
      .then((result) => res.end(JSON.stringify(result)))
      .catch((err) => { res.statusCode = 500; res.end(JSON.stringify({ error: err })); });
    return;
  }

  if (url.pathname === "/snapshot") {
    const script = url.searchParams.get("script");
    const selector = url.searchParams.get("selector") || "body";
    if (!script) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Need ?script=..." }));
      return;
    }
    sendCommand(script, "snapshot", { selector })
      .then((result) => res.end(JSON.stringify(result)))
      .catch((err) => { res.statusCode = 500; res.end(JSON.stringify({ error: err })); });
    return;
  }

  if (url.pathname === "/probe") {
    const script = url.searchParams.get("script");
    const selector = url.searchParams.get("selector");
    if (!script || !selector) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Need ?script=...&selector=..." }));
      return;
    }
    sendCommand(script, "probe", { selector })
      .then((result) => res.end(JSON.stringify(result)))
      .catch((err) => { res.statusCode = 500; res.end(JSON.stringify({ error: err })); });
    return;
  }

  if (url.pathname === "/logs") {
    res.end(JSON.stringify(recentLogs.slice(-100)));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({
    endpoints: [
      "GET /clients — list connected scripts",
      "GET /eval?script=NAME&code=CODE — eval JS in script context",
      "GET /snapshot?script=NAME&selector=SEL — get innerHTML",
      "GET /probe?script=NAME&selector=SEL — check if selector exists",
      "GET /logs — recent log messages from scripts",
    ],
  }));
});

const wss = new WebSocketServer({ server: httpServer });
const recentLogs = [];

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      handleMessage(ws, msg);
    } catch {}
  });

  ws.on("close", () => {
    for (const [name, client] of clients) {
      if (client === ws) {
        console.log(`[disconnect] ${name}`);
        clients.delete(name);
        break;
      }
    }
  });
});

function handleMessage(ws, msg) {
  switch (msg.type) {
    case "register":
      clients.set(msg.script, ws);
      ws._url = msg.url;
      console.log(`[connect] ${msg.script} @ ${msg.url}`);
      break;

    case "log":
      const entry = { ts: msg.ts, script: msg.script, level: msg.level, message: msg.message, data: msg.data };
      recentLogs.push(entry);
      if (recentLogs.length > 500) recentLogs.shift();
      const icon = { info: "ℹ", warn: "⚠", error: "✗" }[msg.level] || "•";
      console.log(`[${msg.script}] ${icon} ${msg.message}`);
      break;

    case "eval-result":
    case "snapshot-result":
    case "probe-result":
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(msg.id);
        pending.resolve(msg);
      }
      break;

    case "pong":
      break;
  }
}

function sendCommand(scriptName, type, data) {
  return new Promise((resolve, reject) => {
    const ws = clients.get(scriptName);
    if (!ws || ws.readyState !== 1) {
      reject(`Script "${scriptName}" not connected`);
      return;
    }
    const id = String(++requestId);
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject("Timeout (5s)");
    }, 5000);
    pendingRequests.set(id, { resolve, timer });
    ws.send(JSON.stringify({ type, id, ...data }));
  });
}

httpServer.listen(PORT, () => {
  console.log(`TM Bridge server on http://localhost:${PORT}`);
  console.log(`Endpoints: /clients /eval /snapshot /probe /logs`);
});
