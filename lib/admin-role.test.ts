import { beforeEach, describe, expect, it, vi } from "vitest";

const { user } = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: { user } }));

import { promoteToAdmin } from "@/lib/admin-role";

beforeEach(() => {
  user.findUnique.mockReset();
  user.update.mockReset();
});

describe("promoteToAdmin", () => {
  it("promotes a customer, looking them up by normalized email", async () => {
    user.findUnique.mockResolvedValue({ role: "CUSTOMER" });

    expect(await promoteToAdmin("  Layla@Example.COM ")).toBe("promoted");
    expect(user.findUnique).toHaveBeenCalledWith({
      where: { email: "layla@example.com" },
      select: { role: true },
    });
    expect(user.update).toHaveBeenCalledWith({
      where: { email: "layla@example.com" },
      data: { role: "ADMIN" },
    });
  });

  it("leaves an existing admin unchanged", async () => {
    user.findUnique.mockResolvedValue({ role: "ADMIN" });

    expect(await promoteToAdmin("admin@example.com")).toBe("already-admin");
    expect(user.update).not.toHaveBeenCalled();
  });

  it("reports an unknown email without creating a user", async () => {
    user.findUnique.mockResolvedValue(null);

    expect(await promoteToAdmin("nobody@example.com")).toBe("not-found");
    expect(user.update).not.toHaveBeenCalled();
  });

  it.each(["", "   ", "not-an-email", "a@b", "a b@example.com"])(
    "rejects %j before touching the database",
    async (email) => {
      expect(await promoteToAdmin(email)).toBe("invalid-email");
      expect(user.findUnique).not.toHaveBeenCalled();
      expect(user.update).not.toHaveBeenCalled();
    },
  );
});
