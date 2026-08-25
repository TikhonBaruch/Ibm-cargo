import { prisma } from "./prisma";

interface AuditLogParams {
  action: string;
  entity: string;
  entityId?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  details?: string;
  ip?: string;
  userAgent?: string;
}

export async function logAction(params: AuditLogParams): Promise<void> {
  // Hidden role: never persist SUPER_ADMIN actions in the product audit trail
  if (params.userRole === "SUPER_ADMIN") return;

  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        entity: params.entity,
        entityId: params.entityId || null,
        userId: params.userId || null,
        userName: params.userName || null,
        userRole: params.userRole || null,
        details: params.details || null,
        ip: params.ip || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}

export async function logLogin(userId: string, userName: string, userRole: string, ip?: string) {
  await logAction({
    action: "LOGIN",
    entity: "auth",
    userId,
    userName,
    userRole,
    ip,
  });
}

export async function logLogout(userId: string, userName: string) {
  await logAction({
    action: "LOGOUT",
    entity: "auth",
    userId,
    userName,
  });
}

export async function logCreate(entity: string, entityId: string, userId: string, userName: string, userRole: string, details?: string) {
  await logAction({
    action: "CREATE",
    entity,
    entityId,
    userId,
    userName,
    userRole,
    details,
  });
}

export async function logUpdate(entity: string, entityId: string, userId: string, userName: string, userRole: string, details?: string) {
  await logAction({
    action: "UPDATE",
    entity,
    entityId,
    userId,
    userName,
    userRole,
    details,
  });
}

export async function logDelete(entity: string, entityId: string, userId: string, userName: string, userRole: string) {
  await logAction({
    action: "DELETE",
    entity,
    entityId,
    userId,
    userName,
    userRole,
  });
}

export async function logPageView(page: string, ip?: string, userAgent?: string) {
  await logAction({
    action: "PAGE_VIEW",
    entity: "page",
    details: page,
    ip,
    userAgent,
  });
}

export async function logUpload(userId: string, userName: string, userRole: string, fileName: string, folder: string) {
  await logAction({
    action: "UPLOAD",
    entity: "file",
    userId,
    userName,
    userRole,
    details: `${folder}/${fileName}`,
  });
}

export async function getLogs(options: {
  action?: string;
  entity?: string;
  userId?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const where: any = {};
  if (options.action) where.action = options.action;
  if (options.entity) where.entity = options.entity;
  if (options.userId) where.userId = options.userId;

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: options.limit || 100,
    skip: options.offset || 0,
  });
}

export async function getLogStats() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalToday, totalWeek, byAction, byEntity] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: today } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { _count: { action: "desc" } } }),
    prisma.auditLog.groupBy({ by: ["entity"], _count: true, orderBy: { _count: { entity: "desc" } } }),
  ]);

  return {
    totalToday,
    totalWeek,
    byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
    byEntity: byEntity.map((e) => ({ entity: e.entity, count: e._count })),
  };
}
