const DEMO_LOCAL_PARTS = ["client", "broker", "manufacturer", "operator", "admin"] as const;

type DemoLocalPart = (typeof DEMO_LOCAL_PARTS)[number];

function isDemoLocalPart(value: string): value is DemoLocalPart {
  return (DEMO_LOCAL_PARTS as readonly string[]).includes(value);
}

/** Trim, lowercase, expand public demo shorthand `client@` → `client@example.com`. */
export function normalizeLoginEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const shorthand = /^([a-z0-9._+-]+)@$/.exec(email);
  if (shorthand && isDemoLocalPart(shorthand[1])) {
    return `${shorthand[1]}@example.com`;
  }
  if (isDemoLocalPart(email)) {
    return `${email}@example.com`;
  }
  return email;
}

export function messageForAuthError(code: string | null | undefined): string {
  if (code === "Configuration") {
    return "Серверу не хватает NEXTAUTH_SECRET (или AUTH_SECRET) в Vercel → Environment Variables. Задайте для Preview и Production.";
  }
  if (code === "Callback" || /DATABASE_URL/i.test(code || "")) {
    return "Нет DATABASE_URL на этом деплое (Prisma: Environment variable not found). Vercel → проект ibm-cargo (этот репозиторий) → Settings → Environment Variables: скопировать DATABASE_URL с Production на Preview (Postgres newlsu_lbm, пароль без #), затем Redeploy. Хост ibm-cargo.vercel.app — чужой проект.";
  }
  return [
    "Неверный email или пароль.",
    "Демо — полный адрес (client@example.com и т.п.).",
    "На Preview DATABASE_URL должен указывать на seeded Postgres newlsu_lbm; иначе зарегистрируйтесь через /register.",
  ].join(" ");
}
