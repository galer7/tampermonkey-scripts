import type { Panel } from "./panel";

export interface ProbeResult {
  selector: string;
  label: string;
  found: boolean;
  count: number;
}

export function probe(selector: string, label: string, root: Element | Document = document): ProbeResult {
  const els = root.querySelectorAll(selector);
  return { selector, label, found: els.length > 0, count: els.length };
}

export function probeAll(
  selectors: Array<{ selector: string; label: string }>,
  root: Element | Document = document
): ProbeResult[] {
  return selectors.map((s) => probe(s.selector, s.label, root));
}

export function logProbeResults(results: ProbeResult[], panel: Panel) {
  let allGood = true;
  for (const r of results) {
    if (r.found) {
      panel.log(`<span style="color:#0cca4a">✓</span> ${r.label} <span style="opacity:0.5">(${r.count})</span>`);
    } else {
      panel.log(`<span style="color:#e94560">✗</span> ${r.label} — <code>${r.selector}</code>`);
      allGood = false;
    }
  }
  if (allGood) {
    panel.log(`<strong style="color:#0cca4a">All selectors OK</strong>`);
  } else {
    panel.log(`<strong style="color:#e94560">Some selectors missing — UI may have changed</strong>`);
  }
}
