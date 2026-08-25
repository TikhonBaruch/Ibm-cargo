"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Lab switcher: new design (/client) vs domain cabinets (unchanged). */
const TABS = [
  { href: "/client", label: "UI lab · клиент", match: "/client" },
  { href: "/cabinet", label: "Функция · cabinet", match: "/cabinet" },
  { href: "/broker", label: "Брокер", match: "/broker" },
  { href: "/admin", label: "Админ", match: "/admin" },
];

export function ProtoBar() {
  const path = usePathname();
  return (
    <div className="proto-bar">
      <strong>ibm-cargo · UI lab</strong>
      <div className="proto-tabs">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={path.startsWith(t.match) ? "active" : ""}>
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
