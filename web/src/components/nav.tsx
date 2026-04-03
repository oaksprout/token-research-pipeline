"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/regime", label: "Regime" },
  { href: "/sectors", label: "Sectors" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/runs", label: "Runs" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-6 px-4">
        <span className="text-sm font-semibold tracking-tight text-zinc-100">
          TRP
        </span>
        <div className="flex gap-1">
          {links.map(({ href, label }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
