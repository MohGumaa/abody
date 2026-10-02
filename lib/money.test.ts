import { describe, expect, it } from "vitest";
import { formatPriceCents } from "@/lib/money";

describe("formatPriceCents", () => {
  it("formats whole dollars", () => {
    expect(formatPriceCents(4900)).toBe("$49.00");
  });

  it("formats cents", () => {
    expect(formatPriceCents(1999)).toBe("$19.99");
  });

  it("formats zero", () => {
    expect(formatPriceCents(0)).toBe("$0.00");
  });

  it("adds thousands separators", () => {
    expect(formatPriceCents(1245000)).toBe("$12,450.00");
  });
});
