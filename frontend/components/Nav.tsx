"use client";

// usePathname braucht den Browser-Router-Zustand -> Client-Komponente.
// Der Rest der App bleibt so weit wie möglich serverseitig gerendert.
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/depot", label: "Depot" },
  { href: "/ampel", label: "Ampel" },
  { href: "/stress", label: "Stress-Test" },
  { href: "/simulation", label: "Simulation" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {LINKS.map(({ href, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap ${
              isActive
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
