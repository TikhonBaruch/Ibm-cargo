#!/usr/bin/env node
/**
 * Smoke: health all six + classify + extract happy-path.
 * Usage: npm run smoke
 * Env: CLASSIFICATION_URL, OCR_URL, … or defaults localhost ports.
 */
const bases = {
  classification: process.env.CLASSIFICATION_URL || "http://127.0.0.1:4500",
  ocr: process.env.OCR_URL || "http://127.0.0.1:4700",
  logistics: process.env.LOGISTICS_URL || "http://127.0.0.1:4601",
  documents: process.env.DOCUMENTS_URL || "http://127.0.0.1:4750",
  broker: process.env.BROKER_URL || "http://127.0.0.1:4800",
  risk: process.env.RISK_URL || "http://127.0.0.1:4900",
};

async function getJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const failures = [];
  for (const [name, base] of Object.entries(bases)) {
    try {
      const { ok, status, body } = await getJson(`${base}/health`);
      assert(ok, `${name} health HTTP ${status}`);
      assert(body && body.ok === true, `${name} health body.ok`);
      console.log(`OK  health ${name} : ${JSON.stringify(body)}`);
    } catch (e) {
      failures.push(String(e.message || e));
      console.error(`FAIL health ${name}:`, e.message || e);
    }
  }

  try {
    const { ok, status, body } = await getJson(`${bases.classification}/v1/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "ноутбук 16 дюймов", country: "Китай" }),
    });
    assert(ok, `classify HTTP ${status}`);
    assert(body?.hsCode, "classify hsCode missing");
    console.log(`OK  classify → ${body.hsCode} conf=${body.confidence}`);
  } catch (e) {
    failures.push(String(e.message || e));
    console.error("FAIL classify:", e.message || e);
  }

  try {
    const { ok, status, body } = await getJson(`${bases.ocr}/v1/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hint: "ноутбук Lenovo", filename: "invoice.pdf" }),
    });
    assert(ok, `extract HTTP ${status}`);
    assert(body?.engine, "extract engine missing");
    console.log(`OK  extract → engine=${body.engine}`);
  } catch (e) {
    failures.push(String(e.message || e));
    console.error("FAIL extract:", e.message || e);
  }

  if (failures.length) {
    console.error(`\nSmoke FAILED (${failures.length})`);
    process.exit(1);
  }
  console.log("\nSmoke PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
