import { describe, expect, it } from "vitest";
import { stripeHostFromEnv } from "./stripe";

const TEST_KEY = "sk_test_secretvalue123";
const LIVE_KEY = "sk_live_secretvalue123";

function message(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected a throw");
}

describe("stripeHostFromEnv", () => {
  it("keeps the real API when unset or blank", () => {
    expect(stripeHostFromEnv(undefined, TEST_KEY)).toBeNull();
    expect(stripeHostFromEnv("", LIVE_KEY)).toBeNull();
    expect(stripeHostFromEnv("   ", LIVE_KEY)).toBeNull();
  });

  it("parses an http URL with a port", () => {
    expect(stripeHostFromEnv("http://localhost:12111", TEST_KEY)).toEqual({
      host: "localhost",
      port: 12111,
      protocol: "http",
    });
  });

  it("parses an https URL without a port", () => {
    expect(stripeHostFromEnv("https://stripe.example.test", TEST_KEY)).toEqual({
      host: "stripe.example.test",
      port: undefined,
      protocol: "https",
    });
  });

  it("refuses a live key", () => {
    expect(() => stripeHostFromEnv("http://localhost:12111", LIVE_KEY)).toThrow(
      /STRIPE_SECRET_KEY is not a test key/,
    );
  });

  it("refuses a value that is not an http URL", () => {
    expect(() => stripeHostFromEnv("localhost:12111", TEST_KEY)).toThrow(
      /STRIPE_API_BASE/,
    );
    expect(() => stripeHostFromEnv("not a url", TEST_KEY)).toThrow(
      /STRIPE_API_BASE is not a valid URL/,
    );
    expect(() => stripeHostFromEnv("ftp://localhost", TEST_KEY)).toThrow(
      /http or https/,
    );
  });

  it("never puts the key in an error message", () => {
    expect(message(() => stripeHostFromEnv("http://x", LIVE_KEY))).not.toContain(LIVE_KEY);
    expect(message(() => stripeHostFromEnv("nope", TEST_KEY))).not.toContain(TEST_KEY);
  });
});
