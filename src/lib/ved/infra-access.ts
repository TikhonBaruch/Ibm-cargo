/**
 * Ops infra summary for SUPER_ADMIN UI.
 * Secrets come only from process.env — never hardcode seed passwords in repo.
 */
import type { EnvBag } from "../env-bag";

export type InfraCredential = {
  label: string;
  address?: string;
  login?: string;
  password?: string;
  notes?: string;
};

export type InfraSection = {
  id: string;
  title: string;
  summary: string;
  credentials: InfraCredential[];
  structure?: string[];
};

export function parsePostgresUrl(raw: string | undefined): {
  host?: string;
  port?: string;
  database?: string;
  user?: string;
  password?: string;
  sslmode?: string | null;
  present: boolean;
} {
  if (!raw) return { present: false };
  try {
    const u = new URL(raw);
    const db = u.pathname.replace(/^\//, "").split("?")[0];
    return {
      present: true,
      host: u.hostname || undefined,
      port: u.port || undefined,
      database: db || undefined,
      user: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      sslmode: u.searchParams.get("sslmode"),
    };
  } catch {
    return { present: true };
  }
}

export function buildInfraSections(env: EnvBag = process.env): InfraSection[] {
  const db = parsePostgresUrl(env.DATABASE_URL);
  const site = env.NEXT_PUBLIC_SITE_URL || env.NEXTAUTH_URL || "";

  const sections: InfraSection[] = [
    {
      id: "structure",
      title: "Структура платформы",
      summary: "Режимы A/B/Vercel и зоны доступа",
      structure: [
        "Mode A — один Next (:3000), Prisma in-process",
        "Mode B — Compose (api/worker/ai + opt-in payments/notify/llm)",
        "Vercel — prod UI, DB внешняя",
        "/cabinet — CLIENT · /broker — BROKER · /manufacturer — MANUFACTURER · /admin — ADMIN (VED)",
        "containers/{api,worker,ai,payments,notify,llm,logistics,ocr,gateway}",
      ],
      credentials: [
        {
          label: "Публичный сайт",
          address: site || "(не задан NEXT_PUBLIC_SITE_URL)",
          notes: "Vercel / local",
        },
        {
          label: "VED-админ",
          address: site ? `${site.replace(/\/$/, "")}/admin` : "/admin",
          notes: "Роль ADMIN · учётки seed только на публичном /login",
        },
      ],
    },
    {
      id: "database",
      title: "База данных (PostgreSQL)",
      summary: db.present
        ? `${db.host || "?"}:${db.port || "5432"} / ${db.database || "?"}`
        : "DATABASE_URL не задан",
      structure: [
        "Провайдер: PostgreSQL (prod: SSL)",
        "ORM: Prisma · schema.prisma",
        "SSL: sslmode=require на prod",
      ],
      credentials: [
        {
          label: "Postgres",
          address: db.present
            ? `${db.host || ""}${db.port ? `:${db.port}` : ""}/${db.database || ""}`
            : undefined,
          login: db.user,
          password: db.password,
          notes: db.sslmode ? `sslmode=${db.sslmode}` : db.present ? undefined : "Задайте DATABASE_URL",
        },
      ],
    },
    {
      id: "storage",
      title: "Object Storage (S3)",
      summary: env.S3_BUCKET ? `bucket ${env.S3_BUCKET}` : "S3 не настроен",
      structure: ["VED uploads → /api/v1/uploads", "Без S3 на Vercel → 503"],
      credentials: [
        {
          label: "S3 / Yandex Object Storage",
          address: env.S3_ENDPOINT
            ? `${env.S3_ENDPOINT} · ${env.S3_REGION || ""} · ${env.S3_BUCKET || ""}`
            : undefined,
          login: env.S3_ACCESS_KEY,
          password: env.S3_SECRET_KEY,
          notes: env.S3_OBJECT_ACL ? `ACL=${env.S3_OBJECT_ACL}` : undefined,
        },
      ],
    },
    {
      id: "hosting",
      title: "Хостинг / SSH / панель",
      summary: env.OPS_HOST || env.OPS_SSH_HOST || "задайте OPS_* в env",
      structure: [
        "Значения из OPS_HOST / OPS_USER / OPS_PASSWORD",
        "SSH: OPS_SSH_HOST / OPS_SSH_USER / OPS_SSH_PASSWORD (или OPS_SSH_KEY_HINT)",
        "Не хранить в git — только Vercel / .env.local",
      ],
      credentials: [
        {
          label: "Панель / хостинг",
          address: env.OPS_HOST,
          login: env.OPS_USER,
          password: env.OPS_PASSWORD,
          notes: env.OPS_NOTES,
        },
        {
          label: "SSH / сервер",
          address: env.OPS_SSH_HOST,
          login: env.OPS_SSH_USER,
          password: env.OPS_SSH_PASSWORD,
          notes: env.OPS_SSH_KEY_HINT || env.OPS_SSH_NOTES,
        },
      ],
    },
    {
      id: "services",
      title: "Сервисные URL",
      summary: "Opt-in контейнеры и ключи (наличие, без лишних секретов)",
      structure: [
        `PAYMENTS_SERVICE_URL: ${env.PAYMENTS_SERVICE_URL ? "задан" : "нет"}`,
        `NOTIFY_SERVICE_URL: ${env.NOTIFY_SERVICE_URL ? "задан" : "нет"}`,
        `LLM_SERVICE_URL: ${env.LLM_SERVICE_URL ? "задан" : "нет"}`,
        `LOGISTICS_SERVICE_URL: ${env.LOGISTICS_SERVICE_URL ? "задан" : "нет"}`,
        `OCR_SERVICE_URL: ${env.OCR_SERVICE_URL ? "задан" : "нет"}`,
        `ALLOW_MOCK_TOPUP: ${env.ALLOW_MOCK_TOPUP ?? "(default)"}`,
        `RESEND_API_KEY: ${env.RESEND_API_KEY ? "задан" : "нет"}`,
      ],
      credentials: [
        {
          label: "Internal API key",
          login: "INTERNAL_API_KEY / CRON_SECRET",
          password: env.INTERNAL_API_KEY || env.CRON_SECRET || undefined,
          notes: "SLA tick / worker",
        },
        {
          label: "SMTP / Resend from",
          address: env.SMTP_FROM,
          password: env.RESEND_API_KEY ? "(RESEND_API_KEY задан)" : undefined,
        },
      ],
    },
  ];

  return sections;
}
