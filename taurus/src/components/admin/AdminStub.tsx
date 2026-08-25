export function AdminStub({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0f172a]" style={{ fontFamily: "var(--kb-font-display, Nunito, sans-serif)" }}>
          {title}
        </h1>
        <p className="mt-1 text-sm text-[#7a7f89]">{description}</p>
      </div>
      <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        {children ?? (
          <p className="text-sm text-[#7a7f89]">
            Раздел подготовлен под продуктовую модель LBM Брокер. Данные и API появятся на следующем этапе.
          </p>
        )}
      </div>
    </div>
  );
}
