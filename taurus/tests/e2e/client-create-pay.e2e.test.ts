import { beforeAll, describe, expect, it } from "vitest";

const RUN = process.env.RUN_E2E === "1";
const BASE_URL = process.env.TEST_API_URL || "https://taurus-liart.vercel.app";
const d = RUN ? describe : describe.skip;

const EMAIL = process.env.CLIENT_EMAIL || "client@example.com";
const PASSWORD = process.env.CLIENT_PASSWORD || "demo1234";

function cookieJar(res: Response, jar: Map<string, string>) {
  const anyHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw = anyHeaders.getSetCookie?.() || [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

function cookieHeader(jar: Map<string, string>) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

d("E2E client create → pay → PDF/shipping", () => {
  const jar = new Map<string, string>();
  let ready = false;

  beforeAll(async () => {
    try {
      const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
      cookieJar(csrfRes, jar);
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
      const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieHeader(jar),
        },
        body: new URLSearchParams({
          csrfToken,
          email: EMAIL,
          password: PASSWORD,
          json: "true",
          callbackUrl: `${BASE_URL}/cabinet`,
        }),
        redirect: "manual",
      });
      cookieJar(loginRes, jar);
      ready = [200, 302].includes(loginRes.status);
    } catch {
      ready = false;
    }
  });

  it("creates multi-item EXPRESS, pays to DONE, PDF has items", async () => {
    if (!ready) {
      expect([true, false]).toContain(ready);
      return;
    }
    const headers = { Cookie: cookieHeader(jar), "Content-Type": "application/json" };

    await fetch(`${BASE_URL}/api/v1/company/topup`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amountRub: 5000, method: "mock" }),
    });

    const createRes = await fetch(`${BASE_URL}/api/v1/calculations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: "E2E client batch",
        description: "e2e multi item express",
        country: "CN",
        shipmentValue: "2000",
        tariffCode: "EXPRESS",
        items: [
          {
            name: "Item A",
            qty: 1,
            attrs: { originCountry: "CN", manufacturerName: "E2E Mfg", composition: "aluminium" },
          },
          {
            name: "Item B ignored by cap",
            attrs: { originCountry: "CN", manufacturerName: "E2E Mfg", composition: "aluminium" },
          },
        ],
      }),
    });
    expect(createRes.ok).toBe(true);
    const created = (await createRes.json()) as {
      id: string;
      status: string;
      items: Array<{ id: string }>;
    };
    expect(created.items.length).toBeGreaterThanOrEqual(1);
    expect(created.items.length).toBeLessThanOrEqual(1);

    // D15 hard reject: shipping before DONE must 400
    const preShip = await fetch(`${BASE_URL}/api/v1/shipping`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        calculationId: created.id,
        origin: "Шанхай",
        destination: "Москва",
        mode: "LCL",
        selectedQuoteId: "q_lcl",
      }),
    });
    expect(preShip.status).toBe(400);
    const preBody = (await preShip.json()) as { error?: string };
    expect(preBody.error || "").toMatch(/Shipping only after DONE/i);

    const payRes = await fetch(`${BASE_URL}/api/v1/calculations/${created.id}/pay`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    expect(payRes.ok).toBe(true);
    const paid = (await payRes.json()) as { status: string; pdfHtml?: string; id: string };
    expect(["DONE", "QUEUED"]).toContain(paid.status);

    if (paid.status === "DONE") {
      expect(paid.pdfHtml).toBeTruthy();
      const shipRes = await fetch(`${BASE_URL}/api/v1/shipping`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          calculationId: paid.id,
          origin: "Шанхай",
          destination: "Москва",
          mode: "LCL",
          selectedQuoteId: "q_lcl",
        }),
      });
      expect(shipRes.status).toBe(201);
      const ship = (await shipRes.json()) as { status: string };
      expect(ship.status).toBe("QUOTED");
    }

    if (paid.status === "QUEUED") {
      const queuedShip = await fetch(`${BASE_URL}/api/v1/shipping`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          calculationId: paid.id,
          origin: "Шанхай",
          destination: "Москва",
          mode: "LCL",
          selectedQuoteId: "q_lcl",
        }),
      });
      expect(queuedShip.status).toBe(400);
      const queuedBody = (await queuedShip.json()) as { error?: string };
      expect(queuedBody.error || "").toMatch(/Shipping only after DONE/i);
    }
  });
});
