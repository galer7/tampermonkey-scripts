type ToastType = "success" | "error" | "info" | "warn";

const COLORS: Record<ToastType, string> = {
  success: "#0cca4a",
  error: "#e94560",
  info: "#3b82f6",
  warn: "#f59e0b",
};

export function toast(msg: string, type: ToastType = "info", durationMs = 3000) {
  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 999999;
    background: ${COLORS[type]}; color: #fff; padding: 12px 20px;
    border-radius: 8px; font-family: system-ui, sans-serif; font-size: 13px;
    font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    opacity: 0; transform: translateY(-10px);
    transition: opacity 0.2s, transform 0.2s;
  `;
  el.textContent = msg;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-10px)";
    setTimeout(() => el.remove(), 200);
  }, durationMs);
}
