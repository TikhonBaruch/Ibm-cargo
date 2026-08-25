"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <h1 className="mb-4 text-4xl font-bold text-slate-100">Ошибка</h1>
      <p className="mb-2 text-lg text-slate-400">Что-то пошло не так</p>
      {error.digest && (
        <p className="mb-6 text-sm text-slate-600">Код: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
      >
        Попробовать снова
      </button>
    </div>
  );
}
