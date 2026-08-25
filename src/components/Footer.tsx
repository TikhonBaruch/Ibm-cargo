export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-[#f5f7fa]">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="text-sm text-[#7a7f89]">
            &copy; {new Date().getFullYear()} LBM Брокер
          </div>
          <div className="text-xs text-[#7a7f89]">
            AI-платформа для импорта и ВЭД
          </div>
        </div>
      </div>
    </footer>
  );
}
