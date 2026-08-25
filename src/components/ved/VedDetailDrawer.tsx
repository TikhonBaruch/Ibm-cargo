"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Mobile: full-screen sheet. Desktop (md+): right drawer.
 * Shared by client orders, broker work, admin bookings/clients.
 */
export function VedDetailDrawer({
  open,
  title,
  subtitle = "Заявка",
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <aside className="absolute inset-0 flex flex-col bg-[#f5f7fa] shadow-2xl md:inset-y-0 md:left-auto md:right-0 md:w-[min(36rem,100%)] md:border-l md:border-black/[0.06]">
        <header className="flex shrink-0 items-center gap-3 border-b border-black/[0.06] bg-white px-4 py-3 md:px-5">
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            aria-label="Назад к списку"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-sm font-bold text-[#0f172a]"
              style={{ fontFamily: "var(--kb-font-display)" }}
            >
              {title}
            </div>
            <div className="text-[11px] font-medium text-[var(--kb-muted)]">{subtitle}</div>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">{children}</div>
      </aside>
    </div>,
    document.body
  );
}
