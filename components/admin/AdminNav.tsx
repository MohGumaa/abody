"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartIcon,
  GlobeIcon,
  GridIcon,
  MegaphoneIcon,
} from "@/components/icons";

// Neutral keys: this file ships to everyone the admin layout responds to,
// including the 404 a non-admin gets, so it holds no admin wording.
const ICONS = {
  chart: ChartIcon,
  globe: GlobeIcon,
  grid: GridIcon,
  megaphone: MegaphoneIcon,
};

export interface AdminNavSection {
  label: string;
  links: { href: string; label: string; icon: keyof typeof ICONS }[];
}

// A client component only to read the path: the layout around it does not
// re-render on navigation. The labels and links come from the server layout.
// Only the link for the exact current page is marked, so a 404 marks nothing.
export function AdminNav({
  label,
  sections,
}: {
  label: string;
  sections: AdminNavSection[];
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label={label}
      className="flex gap-4 overflow-x-auto text-sm font-medium min-[960px]:grid min-[960px]:gap-6 min-[960px]:overflow-visible"
    >
      {sections.map((section) => (
        <div key={section.label} className="flex shrink-0 items-center gap-1 min-[960px]:grid">
          <h2 className="px-3 text-xs font-semibold tracking-wide text-faint uppercase max-[959px]:sr-only">
            {section.label}
          </h2>
          <ul className="flex gap-1 min-[960px]:grid">
            {section.links.map(({ href, label, icon }) => {
              const Icon = ICONS[icon];
              const active = pathname === href;
              return (
                <li key={href} className="shrink-0">
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-control px-3 py-2.5 whitespace-nowrap outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong ${
                      active
                        ? "bg-primary-strong text-white"
                        : "text-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
