#!/usr/bin/env node
/**
 * Normalize raw snapshots → data/tnved/normalized/{codes,notes}.jsonl
 *
 * Merge priority for codes:
 *   1. eec-nsi (СТНВЭДСТ)
 *   2. eec-ett tabular.jsonl + group fallback from manifest
 *   3. tws-csv local leaf dump (fill until NSI available)
 *   4. fts-opendata rates overlay (VAT/excise/prefs)
 * PSN → notes only (not authoritative for codes when NSI/ETT present).
 * Parents 2/4/6/8 synthesized from prefixes (inferred-parent).
 *
 * Usage: npm run tnved:normalize
 */
import fs from "node:fs";
import path from "node:path";
import {
  TNVED_ROOT,
  writeJsonl,
  writeJson,
  readJsonl,
  htmlToText,
  digitsOnly,
  levelFromCode,
  parentCodeOf,
  displayCode,
} from "./tnved-lib.mjs";

function latestDir(base) {
  if (!fs.existsSync(base)) return null;
  const dirs = fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return dirs.length ? path.join(base, dirs[dirs.length - 1]) : null;
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const SOURCE_RANK = {
  "eec-nsi": 1,
  "nsi-stnvedst": 1,
  "eec-ett": 2,
  "tws-csv": 3,
  "fts-opendata": 4,
  "eec-psn": 9,
  "inferred-parent": 8,
  unknown: 99,
};

function upsertCode(map, row, { overlayDutyOnly = false } = {}) {
  const code = digitsOnly(row.code);
  if (!code) return;
  const prev = map.get(code);
  if (overlayDutyOnly && prev) {
    map.set(code, {
      ...prev,
      duty: {
        ...(prev.duty || {}),
        ...(row.duty || {}),
        // keep EEC dutyPct if FTS did not provide one
        dutyPct: row.duty?.dutyPct ?? prev.duty?.dutyPct ?? null,
        source: row.duty?.source || prev.duty?.source,
      },
      ratesOverlaySource: "fts-opendata",
    });
    return;
  }

  const prevRank = SOURCE_RANK[prev?.source] ?? 50;
  const nextRank = SOURCE_RANK[row.source] ?? 50;
  if (prev && prevRank < nextRank) {
    // keep higher-priority title/tree; still allow duty fill
    map.set(code, {
      ...prev,
      duty: prev.duty || row.duty || null,
      notes: prev.notes || row.notes || null,
    });
    return;
  }

  const next = {
    code,
    codeDisplay: row.codeDisplay || displayCode(code),
    level: row.level || levelFromCode(code),
    parentCode: row.parentCode === undefined ? parentCodeOf(code) : row.parentCode,
    titleRu: row.titleRu || prev?.titleRu || code,
    titleEn: row.titleEn ?? prev?.titleEn ?? null,
    isLeaf: row.isLeaf ?? levelFromCode(code) === 10,
    isActive: row.isActive !== false,
    notes: row.notes ?? prev?.notes ?? null,
    source: row.source || prev?.source || "unknown",
    sourceUrl: row.sourceUrl || prev?.sourceUrl || null,
    fetchedAt: row.fetchedAt || prev?.fetchedAt || null,
    duty: row.duty || prev?.duty || null,
  };
  map.set(code, next);
}

function parseDutyFromRecord(r) {
  const dutyPct =
    r.dutyPct ??
    r.DutyPct ??
    r.ImportDuty ??
    r.Rate ??
    r.stavka ??
    (typeof r.duty === "number" ? r.duty : null);
  const vatPct = r.vatPct ?? r.VatPct ?? r.NDS ?? null;
  const note = r.DutyNote || r.Note || r.примечание || null;
  if (dutyPct == null && vatPct == null && !note) return null;
  return {
    dutyKind: r.dutyKind || "AD_VALOREM",
    dutyPct: dutyPct != null ? Number(String(dutyPct).replace(",", ".")) : null,
    vatPct: vatPct != null ? Number(String(vatPct).replace(",", ".")) : null,
    note: note ? String(note) : null,
    source: "eec-nsi",
  };
}

function parseNsiCatalog(file) {
  const text = fs.readFileSync(file, "utf8");
  const map = new Map();
  if (file.endsWith(".json") || text.trimStart().startsWith("[") || text.trimStart().startsWith("{")) {
    const data = JSON.parse(text);
    const rows = Array.isArray(data)
      ? data
      : data.items || data.records || data.Row || data.value || data.d?.results || [];
    for (const r of rows) {
      const code = digitsOnly(r.code || r.CODE || r.Kod || r.код || r.PositionCode || r.TnvedCode);
      const titleRu =
        r.titleRu || r.TEXT || r.Name || r.name || r.наименование || r.PositionName || r.Description || "";
      if (!code) continue;
      upsertCode(map, {
        code,
        titleRu: String(titleRu),
        source: "eec-nsi",
        duty: parseDutyFromRecord(r),
      });
    }
    return map;
  }

  // Paired CODE/TEXT tags
  const codeTags = [
    ...text.matchAll(/<(?:CODE|Kod|код|TnvedCode|PositionCode|CodeValue)[^>]*>([^<]+)<\//gi),
  ];
  const nameTags = [
    ...text.matchAll(/<(?:TEXT|Name|Title|наименование|PositionName|Description)[^>]*>([^<]+)<\//gi),
  ];
  if (codeTags.length && nameTags.length && Math.abs(codeTags.length - nameTags.length) < codeTags.length * 0.1) {
    const n = Math.min(codeTags.length, nameTags.length);
    for (let i = 0; i < n; i++) {
      upsertCode(map, {
        code: codeTags[i][1],
        titleRu: htmlToText(nameTags[i][1]),
        source: "eec-nsi",
      });
    }
  }

  // Self-contained elements with attributes
  const attrRe =
    /<(?:Position|Item|Record|Row|Code)[^>]*(?:code|kod|код)\s*=\s*["'](\d{2,10})["'][^>]*>/gi;
  let m;
  while ((m = attrRe.exec(text))) {
    const chunk = text.slice(m.index, m.index + 800);
    const titleM = chunk.match(/(?:name|title|text|наименование)\s*=\s*["']([^"']+)["']/i);
    const dutyM = chunk.match(/(?:duty|rate|ставк)\w*\s*=\s*["']([^"']+)["']/i);
    upsertCode(map, {
      code: m[1],
      titleRu: titleM ? titleM[1] : m[1],
      source: "eec-nsi",
      duty: dutyM ? { note: dutyM[1], source: "eec-nsi" } : null,
    });
  }

  // Attribute style: code="8471" name="..."
  const attr2 = /code\s*=\s*["'](\d{2,10})["'][^>]*?(?:name|title|text)\s*=\s*["']([^"']+)["']/gi;
  while ((m = attr2.exec(text))) {
    upsertCode(map, { code: m[1], titleRu: m[2], source: "eec-nsi" });
  }

  return map;
}

function codesFromEttManifest(manifestPath) {
  const map = new Map();
  if (!manifestPath || !fs.existsSync(manifestPath)) return map;
  const man = loadJson(manifestPath);
  const fetchedAt = man.meta?.fetchedAt || null;
  for (const p of man.pdfs || []) {
    if (!p.group) continue;
    const code = digitsOnly(p.group).padStart(2, "0").slice(0, 2);
    upsertCode(map, {
      code,
      level: 2,
      parentCode: null,
      titleRu: p.title || `Группа ${code}`,
      isLeaf: false,
      source: "eec-ett",
      sourceUrl: p.href,
      fetchedAt,
      notes: `ETT PDF: ${p.href}`,
    });
  }
  return map;
}

function codesFromPsnToc(tocPath) {
  const map = new Map();
  if (!tocPath || !fs.existsSync(tocPath)) return map;
  const toc = loadJson(tocPath);
  const fetchedAt = toc.meta?.fetchedAt || null;
  for (const e of toc.entries || []) {
    if (e.kind !== "group" || !e.group) continue;
    const code = digitsOnly(e.group).padStart(2, "0").slice(0, 2);
    upsertCode(map, {
      code,
      level: 2,
      parentCode: null,
      titleRu: e.title || `Группа ${code}`,
      isLeaf: false,
      source: "eec-psn",
      sourceUrl: e.href || toc.meta?.sourceUrl,
      fetchedAt,
    });
  }
  return map;
}

function notesFromPsn(psnDir) {
  const notes = [];
  if (!psnDir) return notes;
  const tocPath = path.join(psnDir, "toc.json");
  const toc = fs.existsSync(tocPath) ? loadJson(tocPath) : { meta: {}, entries: [] };
  const edition = path.basename(psnDir);
  const fetchedAt = toc.meta?.fetchedAt || null;

  for (const e of toc.entries || []) {
    notes.push({
      id: `toc-${e.kind}-${e.group || e.title}`.replace(/\s+/g, "_").slice(0, 120),
      edition,
      volume: e.volume || null,
      kind: e.kind,
      anchorCode: e.group ? digitsOnly(e.group).padStart(2, "0") : null,
      path: [e.volume, e.section, e.title].filter(Boolean).join(" / "),
      heading: e.title,
      body: null,
      source: "eec-psn",
      sourceUrl: e.href || toc.meta?.sourceUrl,
      fetchedAt,
    });
  }

  const pagesDir = path.join(psnDir, "pages");
  if (fs.existsSync(pagesDir)) {
    for (const f of fs.readdirSync(pagesDir).filter((x) => x.endsWith(".json") && !x.includes(".error"))) {
      const page = loadJson(path.join(pagesDir, f));
      notes.push({
        id: `page-${f.replace(/\.json$/, "")}`,
        edition,
        volume: page.volume || null,
        kind: page.kind || "page",
        anchorCode: page.group ? digitsOnly(page.group).padStart(2, "0") : null,
        path: [page.volume, page.section, page.title].filter(Boolean).join(" / "),
        heading: page.title,
        body: page.text && !String(page.text).startsWith("%PDF") ? page.text : null,
        source: "eec-psn",
        sourceUrl: page.sourceUrl || page.href,
        fetchedAt: page.fetchedAt || fetchedAt,
      });
    }
  }
  return notes;
}

function loadCandidateLinks(nsiDir, ftsDir) {
  const links = [];
  for (const dir of [nsiDir, ftsDir]) {
    if (!dir) continue;
    const metaPath = path.join(dir, "meta.json");
    if (!fs.existsSync(metaPath)) continue;
    const meta = loadJson(metaPath);
    if (Array.isArray(meta.candidateLinks)) links.push(...meta.candidateLinks);
    const catPath = path.join(dir, "catalog.json");
    if (fs.existsSync(catPath)) {
      const cat = loadJson(catPath);
      for (const it of cat.items || []) if (it.href) links.push(it.href);
    }
  }
  return [...new Set(links)]
    .filter((u) => !/\.(css|js|ico|png|svg|woff2?)(\?|$)/i.test(u))
    .filter((u) => !/oasis-open\.org|w3\.org|schema\.org|vakantdlzn|facebook|twitter/i.test(u))
    .filter((u) =>
      /tnved|стнвэд|stnved|nsi\.eaeunion|opendata\.eaeunion|eaeunion\.org\/odata|catr\/ett|пошлин|list\.csv|catalog\.xml/i.test(
        u,
      ),
    )
    .slice(0, 40);
}

async function main() {
  const psnDir = latestDir(path.join(TNVED_ROOT, "raw", "eec-psn"));
  const ettDir = latestDir(path.join(TNVED_ROOT, "raw", "eec-ett"));
  const nsiDir = latestDir(path.join(TNVED_ROOT, "raw", "nsi-stnvedst"));
  const twsDir = latestDir(path.join(TNVED_ROOT, "raw", "tws-tnved"));
  const ftsDir = latestDir(path.join(TNVED_ROOT, "raw", "fts-opendata"));

  const codeMap = new Map();
  const stats = { nsi: 0, ettTabular: 0, ettGroups: 0, tws: 0, ftsOverlay: 0, psnFallback: 0 };

  // 1) NSI
  if (nsiDir) {
    for (const name of ["catalog.xml", "catalog.json"]) {
      const f = path.join(nsiDir, name);
      if (!fs.existsSync(f)) continue;
      const parsed = parseNsiCatalog(f);
      for (const [, v] of parsed) {
        upsertCode(codeMap, { ...v, source: "eec-nsi" });
        stats.nsi++;
      }
      console.log(`[normalize] NSI ${name}: ${parsed.size} codes`);
    }
  }

  // 2) ETT tabular
  if (ettDir) {
    const tab = path.join(ettDir, "tabular.jsonl");
    if (fs.existsSync(tab)) {
      const rows = readJsonl(tab);
      for (const r of rows) {
        upsertCode(codeMap, { ...r, source: "eec-ett" });
        stats.ettTabular++;
      }
      console.log(`[normalize] ETT tabular: ${rows.length}`);
    }
    const fromMan = codesFromEttManifest(path.join(ettDir, "manifest.json"));
    for (const [, v] of fromMan) {
      if (!codeMap.has(v.code)) {
        upsertCode(codeMap, v);
        stats.ettGroups++;
      }
    }
  }

  // 3) TWS CSV leaves (local drop-in)
  if (twsDir) {
    const twsCodes = path.join(twsDir, "codes.jsonl");
    if (fs.existsSync(twsCodes)) {
      const rows = readJsonl(twsCodes);
      for (const r of rows) {
        upsertCode(codeMap, { ...r, source: "tws-csv" });
        stats.tws++;
      }
      console.log(`[normalize] TWS CSV: ${rows.length}`);
    }
  }

  // 4) FTS overlay
  if (ftsDir) {
    const ratesPath = path.join(ftsDir, "rates.jsonl");
    if (fs.existsSync(ratesPath)) {
      const rates = readJsonl(ratesPath);
      for (const r of rates) {
        if (!codeMap.has(digitsOnly(r.code))) {
          // do not invent tree from FTS alone at low priority — only overlay existing
          continue;
        }
        upsertCode(codeMap, r, { overlayDutyOnly: true });
        stats.ftsOverlay++;
      }
      console.log(`[normalize] FTS overlay applied: ${stats.ftsOverlay}/${rates.length}`);
    }
  }

  // 5) PSN groups only if still thin
  if (codeMap.size < 100 && psnDir) {
    for (const [, v] of codesFromPsnToc(path.join(psnDir, "toc.json"))) {
      if (!codeMap.has(v.code)) {
        upsertCode(codeMap, v);
        stats.psnFallback++;
      }
    }
  }

  // parents 2/4/6/8 from prefixes; prefer title from a child leaf path
  const childTitleHint = new Map();
  for (const row of codeMap.values()) {
    if (row.level !== 10 || !row.titleRu) continue;
    const head = String(row.titleRu).split(/\s*[→🠺]\s*/)[0].trim();
    let p = parentCodeOf(row.code);
    while (p) {
      if (head && !childTitleHint.has(p)) childTitleHint.set(p, head);
      p = parentCodeOf(p);
    }
  }

  for (const code of [...codeMap.keys()]) {
    let p = parentCodeOf(code);
    while (p) {
      if (!codeMap.has(p)) {
        upsertCode(codeMap, {
          code: p,
          titleRu: childTitleHint.get(p) || `Узел ${displayCode(p)}`,
          isLeaf: false,
          source: "inferred-parent",
        });
      }
      p = parentCodeOf(p);
    }
  }

  const codes = [...codeMap.values()].sort((a, b) => a.code.localeCompare(b.code));
  const notes = notesFromPsn(psnDir);
  const leaves10 = codes.filter((c) => c.level === 10).length;

  const outDir = path.join(TNVED_ROOT, "normalized");
  writeJsonl(path.join(outDir, "codes.jsonl"), codes);
  writeJsonl(path.join(outDir, "notes.jsonl"), notes);

  const candidateLinks = loadCandidateLinks(nsiDir, ftsDir);
  const fullEnough = codes.length >= 10000 || leaves10 >= 5000;
  const summary = {
    normalizedAt: new Date().toISOString(),
    codes: codes.length,
    leaves10,
    notes: notes.length,
    stats,
    sources: { psn: psnDir, ett: ettDir, nsi: nsiDir, tws: twsDir, fts: ftsDir },
    candidateLinks,
    gap: fullEnough
      ? null
      : "Full 10-digit nomenclature not loaded yet. Priority: npm run tnved:parse-tws (local CSV), or NSI catalog.xml / NSI_XML_URL, optional ETT XLSX, FTS_DATASET_URL. Do not scrape classifikators/tnved.info/alta.",
  };
  writeJson(path.join(outDir, "summary.json"), summary);
  console.log(`[normalize] codes=${codes.length} leaves10=${leaves10} notes=${notes.length}`);
  if (summary.gap) console.warn(`[normalize] GAP: ${summary.gap}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
