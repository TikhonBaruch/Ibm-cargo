import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <h1 className="mb-4 text-6xl font-bold text-slate-100">404</h1>
      <p className="mb-8 text-lg text-slate-400">Страница не найдена</p>
      <Link
        href="/"
        className="rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
      >
        На главную
      </Link>
    </div>
  );
}
