import { describe, expect, it } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";
import { errorLabel } from "./error-label";

describe("errorLabel", () => {
  it("gives a plain error's name without its message", () => {
    const label = errorLabel(new TypeError("layla@example.com is bad"));
    expect(label).toBe("TypeError");
    expect(label).not.toContain("layla@example.com");
  });

  it("adds the Prisma code", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed on tokenHash 'abc123'",
      { code: "P2002", clientVersion: "test" },
    );
    expect(errorLabel(error)).toBe("PrismaClientKnownRequestError P2002");
  });

  it("names anything that is not an error as unknown", () => {
    expect(errorLabel("layla@example.com")).toBe("unknown error");
    expect(errorLabel(null)).toBe("unknown error");
  });
});
