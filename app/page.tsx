import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "LBM Брокер — AI-платформа для импорта",
  description: "AI определяет код ТН ВЭД, рассчитывает пошлины, проверяет документы, а брокер подтверждает результат",
};

export default function HomePage() {
  return <LandingPage />;
}
