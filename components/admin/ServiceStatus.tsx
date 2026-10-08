import { ServiceStatusChip } from "@/components/account/AccountParts";
import type { ServiceStatus as Status } from "@/lib/generated/prisma/enums";
import { en } from "@/lib/i18n/dictionaries/en";

// The admin's view of a service's work status. Before onboarding there is no
// record, which the admin reads as awaiting the customer.
export function ServiceStatus({ status }: { status: Status | null }) {
  if (status === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface px-3 py-1 text-xs font-semibold whitespace-nowrap text-muted">
        Awaiting details
      </span>
    );
  }
  return <ServiceStatusChip status={status} text={en.account} />;
}
