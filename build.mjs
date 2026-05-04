import { build } from "esbuild";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const srcDir = "src";
const entries = readdirSync(srcDir)
  .filter((f) => f.endsWith(".ts") && !f.startsWith("_"))
  .map((f) => join(srcDir, f));

function extractBanner(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const match = content.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
  return match ? match[0] + "\n" : "";
}

for (const entry of entries) {
  const banner = extractBanner(entry);
  const outfile = entry.replace("src/", "dist/").replace(".ts", ".js");

  await build({
    entryPoints: [entry],
    bundle: true,
    outfile,
    format: "iife",
    target: "es2020",
    platform: "browser",
    banner: { js: banner },
    define: { "process.env.NODE_ENV": '"production"' },
  });
}

console.log(`Built ${entries.length} scripts.`);
