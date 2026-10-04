import Stripe from "stripe";

// Server code only: Server Actions, route handlers, and Server Components.
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client = new Stripe(key);
  return client;
}

// Stripe answers an unknown id with this code.
export function isMissingResource(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === "resource_missing"
  );
}
