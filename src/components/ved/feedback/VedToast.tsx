"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./ved-toast.css";

export type VedToastVariant = "ok" | "error" | "info";

type ToastState = {
  message: string;
  variant: VedToastVariant;
  visible: boolean;
};

type VedToastApi = {
  toast: (message: string, opts?: { variant?: VedToastVariant }) => void;
};

const VedToastContext = createContext<VedToastApi | null>(null);

const HIDE_MS = 2500;

export function VedToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ToastState>({
    message: "",
    variant: "info",
    visible: false,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string, opts?: { variant?: VedToastVariant }) => {
    if (timer.current) clearTimeout(timer.current);
    setState({
      message,
      variant: opts?.variant ?? "info",
      visible: true,
    });
    timer.current = setTimeout(() => {
      setState((s) => ({ ...s, visible: false }));
    }, HIDE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <VedToastContext.Provider value={api}>
      {children}
      <div
        className={`ved-toast ved-toast--${state.variant}${state.visible ? " show" : ""}`}
        role="status"
        aria-live="polite"
      >
        {state.message}
      </div>
    </VedToastContext.Provider>
  );
}

export function useVedToast(): VedToastApi {
  const ctx = useContext(VedToastContext);
  if (!ctx) {
    return {
      toast: () => {
        /* no provider — no-op (SSR / tests) */
      },
    };
  }
  return ctx;
}
