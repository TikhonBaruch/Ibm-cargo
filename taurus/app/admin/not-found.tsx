import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h1 className="mb-4 text-4xl font-bold text-slate-100">404</h1>
      <p className="mb-6 text-slate-400">Страница не найдена</p>
      <Link
        href="/admin"
        className="rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
      >
        На дашборд
      </Link>
    </div>
  );
}
