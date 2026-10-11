import Stripe from "stripe";

// Server code only: Server Actions, route handlers, and Server Components.
let client: Stripe | null = null;

export interface StripeHost {
  host: string;
  port?: number;
  protocol: "http" | "https";
}

// STRIPE_API_BASE points the SDK at a fake Stripe for the browser tests (feature
// 25a). Only a test key may use it, so live payments can never be redirected.
// null keeps the real Stripe API. Never put the key in an error message.
export function stripeHostFromEnv(
  base: string | undefined,
  key: string,
): StripeHost | null {
  const value = base?.trim();
  if (!value) return null;
  if (!key.startsWith("sk_test_")) {
    throw new Error("STRIPE_API_BASE is set but STRIPE_SECRET_KEY is not a test key");
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("STRIPE_API_BASE is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("STRIPE_API_BASE must be an http or https URL");
  }
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    protocol: url.protocol === "http:" ? "http" : "https",
  };
}

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  const host = stripeHostFromEnv(process.env.STRIPE_API_BASE, key);
  client = host ? new Stripe(key, host) : new Stripe(key);
  return client;
}

// Stripe answers an unknown id with this code.
export function isMissingResource(error: unknown): boolean {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    error.code === "resource_missing"
  );
}
