export function CouponStatusChip({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
        active ? "bg-success-soft text-success" : "bg-surface text-muted"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}
