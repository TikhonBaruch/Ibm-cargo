import type { ReactNode } from "react";
import { Manrope, Nunito } from "next/font/google";
import { ClientLabProviders } from "./providers";
import "@/lbm-bro/globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700", "800"],
});

/**
 * ibm-cargo UI lab — lbm-bro client shell.
 * Domain stays on /cabinet + /api/v1 (unchanged).
 */
export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`lbm-bro-root ${manrope.variable} ${nunito.variable}`}>
      <ClientLabProviders>{children}</ClientLabProviders>
    </div>
  );
}
