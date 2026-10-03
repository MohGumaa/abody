"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrentNavPath } from "@/lib/nav";

export interface NavItem {
  href: string;
  label: string;
}

interface MainNavProps {
  label: string;
  items: NavItem[];
}

export function MainNav({ label, items }: MainNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className="order-3 flex w-full gap-1 overflow-x-auto text-sm font-medium min-[960px]:order-none min-[960px]:w-auto min-[960px]:overflow-visible"
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isCurrentNavPath(pathname, item.href) ? "page" : undefined}
          className="rounded-control px-3 py-2 whitespace-nowrap text-muted outline-offset-2 hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary-strong aria-[current=page]:bg-primary-soft aria-[current=page]:text-primary-strong"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
