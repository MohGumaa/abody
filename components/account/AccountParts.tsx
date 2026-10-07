import Link from "next/link";
import type { ReactNode } from "react";
import { DownloadIcon } from "@/components/icons";
import type { AccountDownload } from "@/lib/account";
import { localizedName } from "@/lib/catalog";
import { formatDate } from "@/lib/dates";
import type { OrderStatus, ServiceStatus } from "@/lib/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatOrderNumber } from "@/lib/orders";

type AccountText = Dictionary["account"];

export const ACCOUNT_PANEL =
  "grid min-w-0 gap-6 rounded-panel bg-panel p-5 shadow-soft min-[600px]:p-6 min-[960px]:p-8";

export const TEXT_LINK =
  "rounded-control font-semibold text-primary-strong underline-offset-4 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-strong";

const STATUS_TONES: Record<OrderStatus, string> = {
  PENDING: "bg-warning-soft text-warning",
  PAID: "bg-primary-soft text-primary-strong",
  PROCESSING: "bg-primary-soft text-primary-strong",
  COMPLETED: "bg-success-soft text-success",
  CANCELLED: "bg-danger-soft text-danger",
  REFUNDED: "bg-danger-soft text-danger",
};

export function StatusChip({
  status,
  text,
}: {
  status: OrderStatus;
  text: AccountText;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${STATUS_TONES[status]}`}
    >
      {text.status[status]}
    </span>
  );
}

const SERVICE_STATUS_TONES: Record<ServiceStatus | "none", string> = {
  none: "bg-warning-soft text-warning",
  NEW: "bg-primary-soft text-primary-strong",
  WAITING_FOR_INFORMATION: "bg-warning-soft text-warning",
  IN_PROGRESS: "bg-primary-soft text-primary-strong",
  COMPLETED: "bg-success-soft text-success",
  CANCELLED: "bg-danger-soft text-danger",
};

// A purchased service's status; null means no onboarding details yet.
export function ServiceStatusChip({
  status,
  text,
}: {
  status: ServiceStatus | null;
  text: AccountText;
}) {
  const key = status ?? "none";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${SERVICE_STATUS_TONES[key]}`}
    >
      {text.serviceStatus[key]}
    </span>
  );
}

export function OrderNumber({ number }: { number: number }) {
  return (
    <span dir="ltr" className="font-mono font-semibold">
      {formatOrderNumber(number)}
    </span>
  );
}

export function SectionHead({
  id,
  title,
  link,
}: {
  id: string;
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {link && (
        <Link href={link.href} className={`text-sm ${TEXT_LINK}`}>
          {link.label}
        </Link>
      )}
    </div>
  );
}

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="grid justify-items-start gap-3 rounded-card bg-surface p-5 text-sm">
      <p className="text-muted">{message}</p>
      {action && (
        <Link href={action.href} className={TEXT_LINK}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function PageHead({ title, intro }: { title: string; intro: string }) {
  return (
    <div className="grid gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted">{intro}</p>
    </div>
  );
}

export function DownloadList({
  downloads,
  locale,
  text,
}: {
  downloads: AccountDownload[];
  locale: Locale;
  text: AccountText;
}) {
  return (
    <ul className="grid gap-4">
      {downloads.map((item) => {
        const name = localizedName(item, locale);
        const query = new URLSearchParams({ session_id: item.checkoutSessionId });
        return (
          <li
            key={item.itemId}
            className="flex flex-wrap items-center gap-4 rounded-card border border-border p-4"
          >
            <div className="grid min-w-0 flex-1 gap-1">
              <strong className="font-semibold wrap-break-word" dir="auto">
                {name}
              </strong>
              <span className="text-sm text-muted">
                {text.purchased.replace(
                  "{date}",
                  formatDate(item.purchasedAt, locale),
                )}
                {" · "}
                {text.orderLabel} <OrderNumber number={item.orderNumber} />
              </span>
            </div>
            <a
              href={`/api/downloads/${encodeURIComponent(item.itemId)}?${query}`}
              download
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-control bg-primary-soft px-3 text-sm font-semibold text-primary-strong outline-offset-2 hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary-strong min-[600px]:w-auto"
            >
              <DownloadIcon className="h-4 w-4" />
              {text.download}
              <span className="sr-only">
                {": "}
                <span dir="auto">{name}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function AccountSection({
  labelledBy,
  children,
}: {
  labelledBy: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={labelledBy} className={ACCOUNT_PANEL}>
      {children}
    </section>
  );
}
