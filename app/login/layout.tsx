import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход — LBM Брокер",
  description: "Вход в кабинет LBM Брокер",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
