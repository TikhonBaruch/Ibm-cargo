import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Регистрация — LBM Брокер",
  description: "Регистрация импортёра в LBM Брокер",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
