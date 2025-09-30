// scripts/sanitize.mjs
import fs from "fs";
import path from "path";

const ROOTS = ["client/src", "server", "shared"]; // pas aan wat je in repo gebruikt
const exts = new Set([".tsx", ".ts", ".jsx", ".js", ".css"]);

const RE_BAD = /[\u00A0\u200B\u200C\u200D\uFEFF]/g; // NBSP, ZWSP's, BOM
function cleanText(txt) {
  // vervang “rare” spaties door gewone spaties, en zorg voor nette EOF newline
  const cleaned = txt.replace(RE_BAD, " ").replace(/[ \t]+$/gm, "");
  return cleaned.endsWith("\n") ? cleaned : cleaned + "\n";
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (exts.has(path.extname(entry.name))) {
      const orig = fs.readFileSync(p, "utf8");
      const fixed = cleanText(orig);
      if (fixed !== orig) {
        fs.writeFileSync(p, fixed, "utf8");
        console.log("Sanitized:", p);
      }
    }
  }
}

for (const r of ROOTS) {
  if (fs.existsSync(r)) walk(r);
}
console.log("Sanitize done.");
