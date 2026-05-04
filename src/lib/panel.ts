export interface PanelButton {
  id: string;
  label: string;
  color: string;
  onClick: () => void;
}

export interface Panel {
  log: (msg: string) => void;
  clear: () => void;
  logError: (error: unknown) => void;
  setButtons: (buttons: PanelButton[]) => void;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  element: HTMLElement;
}

import { SelectorError } from "./dom";
import { bridgeLog } from "./bridge";

export function createPanel(title: string, buttons: PanelButton[] = []): Panel {
  const panel = document.createElement("div");
  panel.className = "tm-panel";
  panel.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 99999;
    background: #1a1a2e; color: #eee; border-radius: 12px;
    padding: 16px; font-family: system-ui, sans-serif; font-size: 13px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4); min-width: 280px; max-width: 360px;
  `;

  const header = document.createElement("div");
  header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;";
  header.innerHTML = `<strong style="font-size:14px;">${title}</strong>`;

  const closeBtn = document.createElement("span");
  closeBtn.textContent = "×";
  closeBtn.style.cssText = "cursor:pointer; font-size:18px; opacity:0.6;";
  closeBtn.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  header.appendChild(closeBtn);

  const statusEl = document.createElement("div");
  statusEl.className = "tm-panel-status";
  statusEl.style.cssText = `
    margin-bottom: 12px; padding: 8px; background: #0f3460;
    border-radius: 6px; max-height: 200px; overflow-y: auto;
    font-size: 12px; line-height: 1.6;
  `;

  const buttonRow = document.createElement("div");
  buttonRow.style.cssText = "display:flex; gap:8px;";

  panel.appendChild(header);
  panel.appendChild(statusEl);
  panel.appendChild(buttonRow);
  document.body.appendChild(panel);

  function log(msg: string) {
    statusEl.innerHTML += `<div>${msg}</div>`;
    statusEl.scrollTop = statusEl.scrollHeight;
    console.log(`[${title}] ${msg}`);
    bridgeLog("info", msg.replace(/<[^>]*>/g, ""));
  }

  function clear() {
    statusEl.innerHTML = "";
  }

  function logError(error: unknown) {
    if (error instanceof SelectorError) {
      const id = `tm-err-${Date.now()}`;
      log(`<span style="color:#e94560">ERROR: ${error.message}</span>`);
      log(`<details><summary style="cursor:pointer;color:#f59e0b;">Show HTML context (click to copy)</summary><pre id="${id}" style="font-size:10px;max-height:150px;overflow:auto;white-space:pre-wrap;background:#111;padding:8px;border-radius:4px;cursor:pointer;">${escapeHtml(error.html)}</pre></details>`);
      setTimeout(() => {
        const pre = document.getElementById(id);
        if (pre) {
          pre.addEventListener("click", () => {
            navigator.clipboard.writeText(error.toCopyable());
            pre.style.outline = "2px solid #0cca4a";
            setTimeout(() => { pre.style.outline = ""; }, 1000);
          });
        }
      }, 100);
    } else if (error instanceof Error) {
      log(`<span style="color:#e94560">ERROR: ${error.message}</span>`);
    } else {
      log(`<span style="color:#e94560">ERROR: ${String(error)}</span>`);
    }
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderButtons(btns: PanelButton[]) {
    buttonRow.innerHTML = "";
    for (const btn of btns) {
      const el = document.createElement("button");
      el.id = btn.id;
      el.textContent = btn.label;
      el.style.cssText = `
        flex: 1; padding: 8px 12px; border: none; border-radius: 6px;
        background: ${btn.color}; color: #fff; cursor: pointer; font-weight: 600;
      `;
      el.addEventListener("click", btn.onClick);
      buttonRow.appendChild(el);
    }
  }

  renderButtons(buttons);

  return {
    log,
    clear,
    logError,
    setButtons: renderButtons,
    show: () => { panel.style.display = "block"; },
    hide: () => { panel.style.display = "none"; },
    toggle: () => { panel.style.display = panel.style.display === "none" ? "block" : "none"; },
    element: panel,
  };
}
