"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import {
  BoxIcon,
  DownloadIcon,
  GridIcon,
  MegaphoneIcon,
  UserIcon,
} from "@/components/icons";

export interface AccountNavItem {
  // The account child segment the link opens; null is the overview.
  segment: string | null;
  href: string;
  label: string;
  icon: "overview" | "orders" | "downloads" | "services" | "profile";
}

const ICONS = {
  overview: GridIcon,
  orders: BoxIcon,
  downloads: DownloadIcon,
  services: MegaphoneIcon,
  profile: UserIcon,
};

// A client component only to read the current segment: the layout around it
// does not re-render on navigation.
export function AccountNav({
  label,
  items,
}: {
  label: string;
  items: AccountNavItem[];
}) {
  const current = useSelectedLayoutSegment();
  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto text-sm font-medium min-[960px]:grid min-[960px]:overflow-visible">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.segment === current;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-control p-3 whitespace-nowrap outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-strong ${
                  active
                    ? "bg-primary-strong text-white"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
