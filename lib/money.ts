const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatPriceCents(priceCents: number): string {
  return usd.format(priceCents / 100);
}
