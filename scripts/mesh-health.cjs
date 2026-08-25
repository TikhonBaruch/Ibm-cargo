#!/usr/bin/env node
/** Check host mesh ports (Mode B without Docker). */
const targets = [
  ["llm", "http://127.0.0.1:4500/health"],
  ["ocr", "http://127.0.0.1:4700/health"],
  ["ai", "http://127.0.0.1:4100/health"],
  ["api", "http://127.0.0.1:4000/health"],
  ["worker", "http://127.0.0.1:4200/health"],
  ["payments", "http://127.0.0.1:4300/health"],
  ["notify", "http://127.0.0.1:4400/health"],
  ["logistics", "http://127.0.0.1:4600/health"],
];

async function one([name, url]) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const text = await res.text();
    let body = text;
    try {
      body = JSON.stringify(JSON.parse(text));
    } catch {
      body = text.slice(0, 120);
    }
    const ok = res.ok;
    console.log(`${ok ? "✔" : "✖"} ${name.padEnd(10)} ${res.status} ${body}`);
    return ok;
  } catch (err) {
    console.log(`✖ ${name.padEnd(10)} ${err.message}`);
    return false;
  }
}

(async () => {
  const results = [];
  for (const t of targets) results.push(await one(t));
  if (results.some((ok) => !ok)) process.exit(1);
  console.log("mesh health OK");
})();
