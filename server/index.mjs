import { WebSocketServer } from "ws";
import { createServer } from "http";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, "..", "dist");

const PORT = 9876;
const clients = new Map(); // clientId -> { ws, script, url }
let pendingRequests = new Map(); // id -> { resolve, timer }
let requestId = 0;

const httpServer = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (url.pathname === "/clients") {
    const list = [];
    for (const [id, info] of clients) {
      list.push({ id, script: info.script, url: info.url, connected: info.ws.readyState === 1 });
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
    const script = url.searchParams.get("script");
    const logs = script
      ? recentLogs.filter((l) => l.script === script)
      : recentLogs;
    res.end(JSON.stringify(logs.slice(-100)));
    return;
  }

  if (url.pathname === "/hotswap") {
    const script = url.searchParams.get("script");
    if (!script) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Need ?script=..." }));
      return;
    }
    try {
      const filePath = join(DIST_DIR, `${script}.js`);
      const code = readFileSync(filePath, "utf-8");
      // Strip the userscript header — it's not valid JS
      const stripped = code.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\n?/, "");
      sendCommand(script, "hotswap", { code: stripped })
        .then((result) => res.end(JSON.stringify(result)))
        .catch((err) => { res.statusCode = 500; res.end(JSON.stringify({ error: err })); });
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: `Failed to read dist/${script}.js: ${e.message}` }));
    }
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({
    endpoints: [
      "GET /clients — list connected scripts (supports multiple tabs)",
      "GET /eval?script=NAME&code=CODE — eval JS in script context",
      "GET /snapshot?script=NAME&selector=SEL — get innerHTML",
      "GET /probe?script=NAME&selector=SEL — check if selector exists",
      "GET /hotswap?script=NAME — hot-reload script from dist/ without page refresh",
      "GET /logs[?script=NAME] — recent log messages, optionally filtered",
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
    for (const [id, info] of clients) {
      if (info.ws === ws) {
        console.log(`[disconnect] ${id}`);
        clients.delete(id);
        break;
      }
    }
  });
});

function handleMessage(ws, msg) {
  switch (msg.type) {
    case "register":
      const id = msg.clientId || msg.script;
      clients.set(id, { ws, script: msg.script, url: msg.url });
      console.log(`[connect] ${id} @ ${msg.url}`);
      break;

    case "log": {
      const entry = { ts: msg.ts, script: msg.script, level: msg.level, message: msg.message, data: msg.data };
      recentLogs.push(entry);
      if (recentLogs.length > 500) recentLogs.shift();
      const icon = { info: "ℹ", warn: "⚠", error: "✗" }[msg.level] || "•";
      console.log(`[${msg.script}] ${icon} ${msg.message}`);
      break;
    }

    case "eval-result":
    case "snapshot-result":
    case "probe-result":
    case "hotswap-result": {
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(msg.id);
        pending.resolve(msg);
      }
      break;
    }

    case "pong":
      break;
  }
}

function findClientByScript(scriptName) {
  for (const [, info] of clients) {
    if (info.script === scriptName && info.ws.readyState === 1) {
      return info.ws;
    }
  }
  return null;
}

function sendCommand(scriptName, type, data) {
  return new Promise((resolve, reject) => {
    const ws = findClientByScript(scriptName);
    if (!ws) {
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
