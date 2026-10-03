import { describe, expect, it } from "vitest";
import { isCurrentNavPath } from "@/lib/nav";

describe("isCurrentNavPath", () => {
  it("matches the home link only on the home page", () => {
    expect(isCurrentNavPath("/en", "/en")).toBe(true);
    expect(isCurrentNavPath("/en/", "/en")).toBe(true);
    expect(isCurrentNavPath("/en/cart", "/en")).toBe(false);
    expect(isCurrentNavPath("/ar", "/en")).toBe(false);
  });

  it("matches other links on their own page and sub-pages", () => {
    expect(isCurrentNavPath("/ar/products", "/ar/products")).toBe(true);
    expect(isCurrentNavPath("/ar/products/x", "/ar/products")).toBe(true);
    expect(isCurrentNavPath("/ar/products/x/", "/ar/products")).toBe(true);
  });

  it("does not match a longer sibling path", () => {
    expect(isCurrentNavPath("/en/products-old", "/en/products")).toBe(false);
    expect(isCurrentNavPath("/en/services", "/en/products")).toBe(false);
  });
});
