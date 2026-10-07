"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BoxIcon,
  DashboardIcon,
  ExternalIcon,
  GlobeIcon,
  GridIcon,
  MegaphoneIcon,
} from "@/components/icons";
import { RAIL_CENTER, RAIL_HIDE } from "@/lib/sidebar";

// Neutral names and keys: this file ships to everyone the admin layout
// responds to, including the 404 anyone but an admin gets, so it holds no
// admin wording.
const ICONS = {
  box: BoxIcon,
  dashboard: DashboardIcon,
  globe: GlobeIcon,
  grid: GridIcon,
  megaphone: MegaphoneIcon,
};

export interface SideNavSection {
  label: string;
  // Links that leave the area get a trailing marker.
  external?: boolean;
  links: { href: string; label: string; icon: keyof typeof ICONS }[];
}

// In the icon rail the label turns into a tooltip that shows on hover or
// keyboard focus; it stays in the accessibility tree as the link's name.
const LABEL =
  "min-[960px]:group-data-collapsed/shell:pointer-events-none min-[960px]:group-data-collapsed/shell:absolute min-[960px]:group-data-collapsed/shell:start-full min-[960px]:group-data-collapsed/shell:z-40 min-[960px]:group-data-collapsed/shell:ms-3 min-[960px]:group-data-collapsed/shell:rounded-md min-[960px]:group-data-collapsed/shell:border min-[960px]:group-data-collapsed/shell:border-border min-[960px]:group-data-collapsed/shell:bg-panel min-[960px]:group-data-collapsed/shell:px-2.5 min-[960px]:group-data-collapsed/shell:py-1 min-[960px]:group-data-collapsed/shell:text-xs min-[960px]:group-data-collapsed/shell:font-semibold min-[960px]:group-data-collapsed/shell:text-foreground min-[960px]:group-data-collapsed/shell:shadow-raised min-[960px]:group-data-collapsed/shell:opacity-0 min-[960px]:group-data-collapsed/shell:group-hover/link:opacity-100 min-[960px]:group-data-collapsed/shell:group-focus-visible/link:opacity-100";

// A client component only to read the path: the layout around it does not
// re-render on navigation. The labels and links come from the server layout.
// Only the link for the exact current page is marked, so a 404 marks nothing.
export function SideNav({
  label,
  sections,
}: {
  label: string;
  sections: SideNavSection[];
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="grid gap-5 text-sm font-medium">
      {sections.map((section, index) => (
        <div
          key={section.label}
          className={
            index > 0
              ? "min-[960px]:group-data-collapsed/shell:border-t min-[960px]:group-data-collapsed/shell:border-border min-[960px]:group-data-collapsed/shell:pt-4"
              : undefined
          }
        >
          <h2
            className={`mb-1 px-3 text-[0.6875rem] font-semibold tracking-wider whitespace-nowrap text-faint uppercase ${RAIL_HIDE}`}
          >
            {section.label}
          </h2>
          <ul className="grid gap-0.5">
            {section.links.map(({ href, label, icon }) => {
              const Icon = ICONS[icon];
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`group/link relative flex h-10.5 items-center gap-3 rounded-control px-3 whitespace-nowrap outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong ${RAIL_CENTER} ${
                      active
                        ? "bg-primary-soft font-semibold text-primary-strong before:absolute before:inset-y-2.5 before:-start-3 before:w-0.75 before:rounded-e before:bg-primary-strong"
                        : "text-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className={LABEL}>{label}</span>
                    {section.external && (
                      <ExternalIcon className="ms-auto h-4 w-4 text-faint min-[960px]:group-data-collapsed/shell:hidden" />
                    )}
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
