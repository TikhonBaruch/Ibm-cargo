/**
 * BFF proxy: Next session routes → containers/api (/v1/*).
 * Node-only (Route Handlers). Do not import from Edge middleware / keep root proxy.ts free of this module.
 *
 * Path strip: /api/v1/foo → {base}/v1/foo
 * Auth headers: x-internal-key, x-user-id, x-user-role
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isPublicAuthedPath } from "@/lib/ved/access";
import {
  domainApiBase,
  isDomainApiEnabled,
  stripApiV1Prefix,
} from "@/lib/ved/proxy-paths";

export {
  domainApiBase,
  isDomainApiEnabled,
  mustStayOnNext,
  stripApiV1Prefix,
} from "@/lib/ved/proxy-paths";

const LOG = "[bff-proxy]";

export function internalApiKey(): string {
  return process.env.INTERNAL_API_KEY || process.env.NEXTAUTH_SECRET || "";
}

export type BffSessionUser = { id: string; role?: string };

export function buildDomainHeaders(opts: {
  userId?: string;
  role?: string;
  contentType?: string | null;
  extra?: HeadersInit;
}): Headers {
  const headers = new Headers(opts.extra);
  headers.set("x-internal-key", internalApiKey());
  if (opts.userId) headers.set("x-user-id", opts.userId);
  if (opts.role) headers.set("x-user-role", opts.role);
  if (opts.contentType) {
    headers.set("Content-Type", opts.contentType);
  } else if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

/**
 * Low-level fetch to domain API. `domainPath` must start with /v1.
 * Returns null when domain proxy is disabled / URL missing.
 */
export async function proxyDomainApi(
  domainPath: string,
  opts: {
    method?: string;
    userId: string;
    role?: string;
    body?: unknown;
    query?: string | URLSearchParams;
  }
): Promise<Response | null> {
  if (process.env.USE_DOMAIN_API !== "1") return null;
  const base = domainApiBase();
  if (!base) return null;
  const q =
    opts.query instanceof URLSearchParams
      ? opts.query.toString()
      : opts.query
        ? String(opts.query).replace(/^\?/, "")
        : "";
  const path = domainPath.startsWith("/v1") ? domainPath : stripApiV1Prefix(domainPath);
  const url = `${base}${path}${q ? `?${q}` : ""}`;
  try {
    return await fetch(url, {
      method: opts.method || "GET",
      headers: buildDomainHeaders({
        userId: opts.userId,
        role: opts.role || "BROKER",
      }),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    console.error(LOG, "domain fetch failed", { url, err: String(err) });
    return new Response(
      JSON.stringify({
        error: "Domain API unreachable",
        detail: err instanceof Error ? err.message : String(err),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

/** Forward domain Response as NextResponse (JSON or HTML). */
export async function forwardDomainResponse(proxied: Response): Promise<NextResponse> {
  const ct = proxied.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    const text = await proxied.text();
    const headers = new Headers();
    headers.set("Content-Type", ct);
    const disp = proxied.headers.get("content-disposition");
    if (disp) headers.set("Content-Disposition", disp);
    return new NextResponse(text, { status: proxied.status, headers });
  }
  const data = await proxied.json().catch(() => ({ error: "Bad domain response" }));
  return NextResponse.json(data, { status: proxied.status });
}

/**
 * Full BFF for a Next Request → domain /v1/*.
 */
export async function handleBffProxy(req: NextRequest, domainPath: string): Promise<NextResponse> {
  if (!isDomainApiEnabled()) {
    console.error(LOG, "DOMAIN_API_URL / API_SERVICE_URL missing or USE_DOMAIN_API≠1");
    return NextResponse.json(
      { error: "Domain API not configured", hint: "Set DOMAIN_API_URL and USE_DOMAIN_API=1" },
      { status: 503 }
    );
  }

  const base = domainApiBase()!;
  const method = req.method || "GET";
  const publicOk = isPublicAuthedPath(domainPath.replace(/^\/v1/, "/api/v1"), method);

  const session = await getServerSession(authOptions);
  const user = session?.user as BffSessionUser | undefined;

  if (!user?.id && !publicOk) {
    const internal =
      req.headers.get("x-internal-key") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const expected =
      process.env.INTERNAL_API_KEY ||
      process.env.CRON_SECRET ||
      process.env.NEXTAUTH_SECRET;
    if (!(expected && internal && internal === expected)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(req.url);
  const target = `${base}${domainPath}${url.search}`;

  const headers = buildDomainHeaders({
    userId: user?.id,
    role: user?.role,
    contentType: req.headers.get("content-type"),
  });
  const incomingKey =
    req.headers.get("x-internal-key") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (incomingKey && !user?.id) {
    headers.set("x-internal-key", incomingKey);
  }

  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await req.arrayBuffer();
    } catch (err) {
      console.error(LOG, "failed to read request body", { err: String(err) });
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
    });
    return forwardDomainResponse(upstream);
  } catch (err) {
    console.error(LOG, "upstream connection error", {
      target,
      method,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: "Domain API unreachable",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
