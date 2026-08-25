import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/Providers";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { bootAuthEnv } from "@/lib/auth-env";
import { resolveSiteUrl } from "@/lib/site-url";
import "./globals.css";

bootAuthEnv();

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  title: "LBM Брокер — AI-платформа для импорта",
  description: "AI определяет код ТН ВЭД, рассчитывает пошлины, проверяет документы, а брокер подтверждает результат",
  authors: [{ name: "Varukha Andrey" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LBM",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    title: "LBM Брокер — AI-платформа для импорта",
    description: "AI определяет код ТН ВЭД, рассчитывает пошлины, проверяет документы",
    siteName: "LBM Брокер",
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LBM Брокер — AI-платформа для импорта",
    description: "AI определяет код ТН ВЭД, рассчитывает пошлины, проверяет документы",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f7fa",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Nunito:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        <Providers>
          <div className="min-h-dvh">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
