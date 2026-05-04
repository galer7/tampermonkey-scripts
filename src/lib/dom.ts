export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SelectorError extends Error {
  selector: string;
  html: string;

  constructor(selector: string, html: string) {
    super(`Selector not found: ${selector}`);
    this.name = "SelectorError";
    this.selector = selector;
    this.html = html;
  }

  toCopyable(): string {
    return [
      `SELECTOR FAILED: ${this.selector}`,
      ``,
      `Surrounding HTML:`,
      this.html,
    ].join("\n");
  }
}

function dumpContext(root: Element | Document, maxLength = 3000): string {
  const el = root instanceof Document ? root.body : root;
  const html = el.innerHTML;
  if (html.length <= maxLength) return html;
  return html.slice(0, maxLength) + "\n... (truncated)";
}

export async function waitForElement(
  selector: string,
  root: Element | Document = document,
  timeout = 10000
): Promise<HTMLElement> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = root.querySelector(selector);
    if (el) return el as HTMLElement;
    await wait(200);
  }
  const context = dumpContext(root);
  throw new SelectorError(selector, context);
}

export async function waitForVisible(
  selector: string,
  root: Element | Document = document,
  timeout = 10000
): Promise<HTMLElement> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const els = root.querySelectorAll<HTMLElement>(selector);
    for (let i = 0; i < els.length; i++) {
      if (els[i].offsetParent !== null || els[i].style.display !== "none") {
        return els[i];
      }
    }
    await wait(200);
  }
  throw new Error(`Visible element not found: ${selector}`);
}

export function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  if (setter) {
    setter.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.dispatchEvent(new Event("blur", { bubbles: true }));
}

export async function clickAndWait(el: HTMLElement, ms = 300) {
  el.click();
  await wait(ms);
}
