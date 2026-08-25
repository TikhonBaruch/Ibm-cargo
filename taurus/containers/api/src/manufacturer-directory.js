/**
 * Dual-path manufacturer directory / proposals (plan-manufacturer-proposals.md).
 * Mirrors src/lib/ved/manufacturer-directory.ts for USE_DOMAIN_API=1.
 */
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

export async function listManufacturerDirectory(prisma, { userId, q, limit = 20 }) {
  const take = Math.min(Math.max(limit, 1), 50);
  const query = (q || "").trim();
  const whereName = query ? { name: { contains: query, mode: "insensitive" } } : {};

  const [companies, ownPending] = await Promise.all([
    prisma.company.findMany({
      where: { kind: "MANUFACTURER", ...whereName },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take,
    }),
    prisma.manufacturerProposal.findMany({
      where: { proposedByUserId: userId, status: "PENDING", ...whereName },
      select: { id: true, name: true, country: true },
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  const approved = companies.map((c) => ({
    id: `co:${c.id}`,
    name: c.name,
    kind: "approved",
    companyId: c.id,
  }));
  const pending = ownPending.map((p) => ({
    id: `pr:${p.id}`,
    name: p.name,
    kind: "pending",
    country: p.country,
    proposalId: p.id,
  }));

  const seen = new Set();
  const out = [];
  for (const row of [...pending, ...approved]) {
    const key = row.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= take) break;
  }
  return out;
}

export async function createManufacturerProposal(prisma, { userId, role, body }) {
  if (role !== "CLIENT" && role !== "BROKER") {
    throw httpError(403, "Only CLIENT or BROKER can propose manufacturers");
  }
  const name = normalizeName(body?.name);
  if (name.length < 2 || name.length > 200) throw httpError(400, "Invalid name");
  const country = body?.country ? String(body.country).trim().slice(0, 80) : null;
  const note = body?.note ? String(body.note).trim().slice(0, 500) : null;

  const existingCompany = await prisma.company.findFirst({
    where: { kind: "MANUFACTURER", name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (existingCompany) {
    throw httpError(409, `Производитель «${existingCompany.name}» уже в постоянном каталоге`);
  }

  const dupPending = await prisma.manufacturerProposal.findFirst({
    where: {
      proposedByUserId: userId,
      status: "PENDING",
      name: { equals: name, mode: "insensitive" },
    },
  });
  if (dupPending) {
    return {
      id: dupPending.id,
      name: dupPending.name,
      country: dupPending.country,
      note: dupPending.note,
      status: dupPending.status,
      sourceRole: dupPending.sourceRole,
      createdAt: dupPending.createdAt,
      duplicate: true,
    };
  }

  const row = await prisma.manufacturerProposal.create({
    data: {
      name,
      country,
      note,
      sourceRole: role,
      proposedByUserId: userId,
    },
  });
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    note: row.note,
    status: row.status,
    sourceRole: row.sourceRole,
    createdAt: row.createdAt,
    duplicate: false,
  };
}

export async function listManufacturerProposalsForAdmin(prisma, { status, q, limit = 100 }) {
  const take = Math.min(Math.max(limit, 1), 200);
  const st = status && status !== "all" ? status : undefined;
  const query = (q || "").trim();
  return prisma.manufacturerProposal.findMany({
    where: {
      ...(st ? { status: st } : {}),
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    include: {
      proposedByUser: { select: { id: true, name: true, email: true, role: true } },
      reviewedByUser: { select: { id: true, name: true } },
      approvedCompany: { select: { id: true, name: true, kind: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take,
  });
}

export async function listApprovedManufacturerCompanies(prisma, { q, limit = 100 } = {}) {
  const take = Math.min(Math.max(limit, 1), 200);
  const query = (q || "").trim();
  return prisma.company.findMany({
    where: {
      kind: "MANUFACTURER",
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    select: {
      id: true,
      name: true,
      inn: true,
      contactEmail: true,
      contactPhone: true,
      createdAt: true,
      _count: { select: { manufacturerSkus: true, users: true } },
    },
    orderBy: { name: "asc" },
    take,
  });
}

export async function approveManufacturerProposal(prisma, { proposalId, actorUserId }) {
  const proposal = await prisma.manufacturerProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw httpError(404, "Proposal not found");
  if (proposal.status === "APPROVED" && proposal.approvedCompanyId) {
    const company = await prisma.company.findUnique({
      where: { id: proposal.approvedCompanyId },
      select: { id: true, name: true, kind: true },
    });
    return { proposal, company };
  }
  if (proposal.status !== "PENDING") {
    throw httpError(409, "Only PENDING proposals can be approved");
  }

  const name = normalizeName(proposal.name);
  let company = await prisma.company.findFirst({
    where: { kind: "MANUFACTURER", name: { equals: name, mode: "insensitive" } },
  });

  return prisma.$transaction(async (tx) => {
    if (!company) {
      company = await tx.company.create({
        data: { name, kind: "MANUFACTURER" },
      });
    }
    const updated = await tx.manufacturerProposal.update({
      where: { id: proposal.id },
      data: {
        status: "APPROVED",
        approvedCompanyId: company.id,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
        rejectReason: null,
      },
      include: {
        proposedByUser: { select: { id: true, name: true, email: true, role: true } },
        approvedCompany: { select: { id: true, name: true, kind: true } },
      },
    });
    return { proposal: updated, company };
  });
}

export async function rejectManufacturerProposal(prisma, { proposalId, actorUserId, body }) {
  const proposal = await prisma.manufacturerProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) throw httpError(404, "Proposal not found");
  if (proposal.status !== "PENDING") {
    throw httpError(409, "Only PENDING proposals can be rejected");
  }
  const reason = body?.reason ? String(body.reason).trim().slice(0, 400) : null;
  return prisma.manufacturerProposal.update({
    where: { id: proposal.id },
    data: {
      status: "REJECTED",
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
      rejectReason: reason,
    },
    include: {
      proposedByUser: { select: { id: true, name: true, email: true, role: true } },
      reviewedByUser: { select: { id: true, name: true } },
    },
  });
}

/**
 * @returns true if request handled
 */
export async function handleManufacturerDirectoryRoutes({
  req,
  res,
  url,
  prisma,
  authorize,
  json,
  readBody,
}) {
  const path = url.pathname;
  const isDir =
    path.startsWith("/v1/manufacturers/") || path.startsWith("/v1/admin/manufacturer-proposals");
  if (!isDir) return false;

  const user = authorize(req);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return true;
  }
  const userId = user.id;
  const role = user.role;

  try {
    if (path === "/v1/manufacturers/directory" && req.method === "GET") {
      if (!["CLIENT", "BROKER", "ADMIN", "SUPER_ADMIN"].includes(role)) {
        json(res, 403, { error: "Forbidden" });
        return true;
      }
      const q = typeof url.searchParams?.get === "function" ? url.searchParams.get("q") : undefined;
      json(res, 200, await listManufacturerDirectory(prisma, { userId, q: q || undefined }));
      return true;
    }

    if (path === "/v1/manufacturers/proposals" && req.method === "POST") {
      const body = await readBody(req);
      const row = await createManufacturerProposal(prisma, { userId, role, body: body || {} });
      json(res, row.duplicate ? 200 : 201, row);
      return true;
    }

    if (path.startsWith("/v1/admin/manufacturer-proposals")) {
      if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
        json(res, 403, { error: "Forbidden" });
        return true;
      }

      if (path === "/v1/admin/manufacturer-proposals" && req.method === "GET") {
        const status =
          typeof url.searchParams?.get === "function"
            ? url.searchParams.get("status") || "PENDING"
            : "PENDING";
        const q =
          typeof url.searchParams?.get === "function" ? url.searchParams.get("q") : undefined;
        const proposals = await listManufacturerProposalsForAdmin(prisma, {
          status,
          q: q || undefined,
        });
        const approvedFlag =
          typeof url.searchParams?.get === "function" && url.searchParams.get("approved") === "1";
        if (approvedFlag) {
          const companies = await listApprovedManufacturerCompanies(prisma, {
            q: q || undefined,
          });
          json(res, 200, { proposals, companies });
        } else {
          json(res, 200, { proposals });
        }
        return true;
      }

      const approveMatch = path.match(/^\/v1\/admin\/manufacturer-proposals\/([^/]+)\/approve$/);
      if (approveMatch && req.method === "POST") {
        json(
          res,
          200,
          await approveManufacturerProposal(prisma, {
            proposalId: approveMatch[1],
            actorUserId: userId,
          })
        );
        return true;
      }

      const rejectMatch = path.match(/^\/v1\/admin\/manufacturer-proposals\/([^/]+)\/reject$/);
      if (rejectMatch && req.method === "POST") {
        const body = await readBody(req);
        json(
          res,
          200,
          await rejectManufacturerProposal(prisma, {
            proposalId: rejectMatch[1],
            actorUserId: userId,
            body: body || {},
          })
        );
        return true;
      }
    }

    json(res, 405, { error: "Method not allowed" });
    return true;
  } catch (e) {
    json(res, e.status || 400, { error: e instanceof Error ? e.message : "Error" });
    return true;
  }
}

