import { describe, expect, it } from "vitest";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "./password";

describe("hashPassword and verifyPassword", () => {
  it("verifies the password it hashed", async () => {
    const stored = await hashPassword("correct horse");

    expect(stored).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword("correct horse", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("correct horse");

    expect(await verifyPassword("correct horsE", stored)).toBe(false);
  });

  it("uses a new salt every time", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same password"),
      hashPassword("same password"),
    ]);

    expect(a).not.toBe(b);
  });

  it("verifies Arabic passwords", async () => {
    const stored = await hashPassword("كلمة سر طويلة");

    expect(await verifyPassword("كلمة سر طويلة", stored)).toBe(true);
  });

  it.each([
    "",
    "plain",
    "bcrypt$16384$8$1$c2FsdA$aGFzaA",
    "scrypt$x$8$1$c2FsdA$aGFzaA",
    "scrypt$16384$8$1$$aGFzaA",
    "scrypt$16384$8$1$c2FsdA$",
    "scrypt$3$8$1$c2FsdA$aGFzaA",
  ])("never matches the malformed hash %j", async (stored) => {
    expect(await verifyPassword("anything", stored)).toBe(false);
  });

  it("never matches the dummy hash", async () => {
    expect(await verifyPassword("", DUMMY_PASSWORD_HASH)).toBe(false);
    expect(await verifyPassword("password", DUMMY_PASSWORD_HASH)).toBe(false);
  });
});
