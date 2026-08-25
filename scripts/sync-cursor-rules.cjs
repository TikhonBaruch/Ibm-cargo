#!/usr/bin/env node
/**
 * Sync docs/knowledge/ved-*.mdc → .cursor/rules/ (IDE alwaysApply surface).
 * Canon lives in docs/knowledge; Cursor only loads .cursor/rules.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "docs", "knowledge");
const destDir = path.join(root, ".cursor", "rules");

fs.mkdirSync(destDir, { recursive: true });
const files = fs.readdirSync(srcDir).filter((f) => /^ved-.*\.mdc$/.test(f));
if (!files.length) {
  console.error("no ved-*.mdc in docs/knowledge");
  process.exit(1);
}
for (const f of files) {
  fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  console.log("synced", f);
}
console.log(`ok ${files.length} → .cursor/rules/`);
