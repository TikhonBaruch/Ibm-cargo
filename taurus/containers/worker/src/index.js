import http from "node:http";
import { randomUUID } from "node:crypto";

const port = Number(process.env.PORT || 4200);
const redisUrl = process.env.REDIS_URL || "redis://redis:6379";
const apiUrl = (process.env.API_SERVICE_URL || "http://api:4000").replace(/\/$/, "");
const webUrl = (process.env.WEB_SERVICE_URL || process.env.WEB_ORIGIN || "http://web:3000").replace(
  /\/$/,
  ""
);
const internalKey = process.env.INTERNAL_API_KEY || process.env.NEXTAUTH_SECRET || "";
const tickMs = Number(process.env.SLA_TICK_INTERVAL_MS || 60_000);
const workerId = `worker-${randomUUID().slice(0, 8)}`;

/** Local mirror of last jobs for GET /v1/jobs (durable store is Postgres via api). */
const jobsMirror = [];

function mirror(job) {
  jobsMirror.unshift(job);
  if (jobsMirror.length > 50) jobsMirror.length = 50;
}

async function postInternal(path, body = {}) {
  const targets = [`${apiUrl}${path}`, `${webUrl}/api${path}`];
  let lastErr = "no target";
  for (const url of targets) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-key": internalKey,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, url, data, status: res.status };
      lastErr = `HTTP ${res.status}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, error: lastErr };
}

async function getInternal(path) {
  const targets = [`${apiUrl}${path}`, `${webUrl}/api${path}`];
  for (const url of targets) {
    try {
      const res = await fetch(url, {
        headers: { "x-internal-key": internalKey },
      });
      if (res.ok) return await res.json().catch(() => ({}));
    } catch {
      /* try next */
    }
  }
  return { jobs: jobsMirror.slice(0, 20) };
}

async function enqueueDurable(kind, payload = {}) {
  const r = await postInternal("/v1/internal/jobs", { kind, payload, action: "enqueue" });
  const job = r.data?.job || {
    id: `local_${Date.now()}`,
    kind,
    status: r.ok ? "QUEUED" : "FAILED",
    payload,
  };
  mirror({ ...job, localAt: new Date().toISOString() });
  return { ...r, job };
}

async function runSlaTickJob(payload = {}) {
  const enq = await enqueueDurable("SLA_TICK", payload);
  const tick = await postInternal("/v1/internal/sla-tick", payload);
  if (enq.job?.id && enq.ok) {
    await postInternal("/v1/internal/jobs", {
      action: "finish",
      id: enq.job.id,
      ok: tick.ok,
      result: tick.data,
      error: tick.ok ? null : tick.error,
      attempts: 1,
    });
  }
  // Drain notify outbox after SLA side-effects
  await enqueueDurable("OUTBOX_DRAIN", { source: "after-sla" });
  await postInternal("/v1/internal/outbox/drain", { limit: 20 });
  return {
    id: enq.job?.id,
    kind: "SLA_TICK",
    status: tick.ok ? "done" : "failed",
    result: tick.data,
    error: tick.ok ? undefined : tick.error,
    finishedAt: new Date().toISOString(),
  };
}

async function runOutboxDrain(payload = {}) {
  const enq = await enqueueDurable("OUTBOX_DRAIN", payload);
  const drain = await postInternal("/v1/internal/outbox/drain", { limit: payload.limit || 20 });
  if (enq.job?.id && enq.ok) {
    await postInternal("/v1/internal/jobs", {
      action: "finish",
      id: enq.job.id,
      ok: drain.ok,
      result: drain.data,
      error: drain.ok ? null : drain.error,
      attempts: 1,
    });
  }
  return {
    id: enq.job?.id,
    kind: "OUTBOX_DRAIN",
    status: drain.ok ? "done" : "failed",
    result: drain.data,
    finishedAt: new Date().toISOString(),
  };
}

async function runAiDrainClaimed() {
  const claimed = await postInternal("/v1/internal/jobs", {
    action: "claim",
    kinds: ["AI_DRAIN"],
    lockedBy: workerId,
    limit: 3,
  });
  const jobs = claimed.data?.jobs || [];
  const results = [];
  for (const job of jobs) {
    if (!job?.id) continue;
    const payload = job.payload && typeof job.payload === "object" ? job.payload : {};
    const calculationId = job.calculationId || payload.calculationId;
    if (!calculationId) {
      await postInternal("/v1/internal/jobs", {
        action: "finish",
        id: job.id,
        ok: false,
        error: "AI_DRAIN missing calculationId",
        attempts: job.attempts || 1,
        maxAttempts: job.maxAttempts || 5,
      });
      results.push({ id: job.id, ok: false, error: "missing calculationId" });
      continue;
    }
    const run = await postInternal("/v1/internal/ai-drain", { calculationId, jobId: job.id });
    const ok = Boolean(run.ok && run.data && run.data.ok !== false && !run.data.error);
    await postInternal("/v1/internal/jobs", {
      action: "finish",
      id: job.id,
      ok,
      result: run.data || {},
      error: ok ? null : run.data?.error || run.error || "ai-drain failed",
      attempts: job.attempts || 1,
      maxAttempts: job.maxAttempts || 5,
    });
    results.push({ id: job.id, ok, error: ok ? undefined : run.data?.error || run.error });
  }
  return { claimed: jobs.length, results };
}

const intervalIds = [];
let stopping = false;
const inFlight = new Set();

function runTracked(fn) {
  if (stopping) return;
  const p = Promise.resolve()
    .then(fn)
    .catch((err) => {
      console.error("[worker] tick error", err);
    })
    .finally(() => inFlight.delete(p));
  inFlight.add(p);
}

async function stopWorker() {
  stopping = true;
  for (const id of intervalIds) clearInterval(id);
  intervalIds.length = 0;
  await Promise.allSettled([...inFlight]);
}

if (tickMs > 0) {
  intervalIds.push(
    setInterval(() => {
      runTracked(() => runSlaTickJob({ source: "interval", workerId }));
      runTracked(() => runAiDrainClaimed());
    }, tickMs)
  );
  console.log(
    `[worker] SLA_TICK+OUTBOX_DRAIN+AI_DRAIN every ${tickMs}ms → api ${apiUrl} (fallback web ${webUrl}) id=${workerId}`
  );
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

  if (url.pathname === "/health") {
    res.end(JSON.stringify({ ok: true, service: "worker", redisUrl, apiUrl, webUrl, workerId }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/jobs") {
    const durable = await getInternal("/v1/internal/jobs");
    res.end(JSON.stringify({ jobs: durable.jobs || jobsMirror.slice(0, 20), mirror: jobsMirror.slice(0, 10) }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/jobs") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }
    const kind = body.kind || "SLA_TICK";
    if (kind === "SLA_TICK") {
      res.end(JSON.stringify(await runSlaTickJob(body.payload || {})));
      return;
    }
    if (kind === "OUTBOX_DRAIN") {
      res.end(JSON.stringify(await runOutboxDrain(body.payload || {})));
      return;
    }
    if (kind === "AI_DRAIN") {
      const drain = await runAiDrainClaimed();
      res.end(JSON.stringify({ kind: "AI_DRAIN", ...drain }));
      return;
    }
    const enq = await enqueueDurable(kind, body.payload || {});
    if (enq.job?.id && enq.ok) {
      await postInternal("/v1/internal/jobs", {
        action: "finish",
        id: enq.job.id,
        ok: false,
        error: `unhandled kind ${kind}`,
        attempts: 1,
        maxAttempts: 1,
      });
    }
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        id: enq.job?.id,
        kind,
        status: "failed",
        error: `unhandled kind ${kind}`,
        finishedAt: new Date().toISOString(),
      })
    );
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found", hint: "POST /v1/jobs { kind, payload }" }));
});

server.listen(port, () => console.log(`[worker] on :${port}`));

function shutdown(signal) {
  console.log(`[worker] ${signal} — stopWorker`);
  void stopWorker().then(
    () =>
      new Promise((resolve) => {
        server.close(() => resolve(undefined));
      })
  ).then(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
