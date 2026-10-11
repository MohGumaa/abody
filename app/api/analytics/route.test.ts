import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordPageView } = vi.hoisted(() => ({ recordPageView: vi.fn() }));

vi.mock("@/lib/analytics", () => ({ recordPageView }));

import { POST } from "./route";

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

beforeEach(() => {
  recordPageView.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/analytics", () => {
  it("records a page view and returns 204", async () => {
    const response = await POST(request(JSON.stringify({ path: "/en" })));

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(recordPageView).toHaveBeenCalledWith("/en", null);
  });

  it("passes a detail page to the recorder", async () => {
    await POST(request(JSON.stringify({ path: "/ar/products/guide" })));

    expect(recordPageView).toHaveBeenCalledWith("/ar/products/guide", {
      type: "DIGITAL_PRODUCT",
      slug: "guide",
    });
  });

  it.each([
    ["bad JSON", "{path:"],
    ["a non-object body", JSON.stringify("/en")],
    ["a null body", "null"],
    ["a missing path", JSON.stringify({})],
    ["an invalid path", JSON.stringify({ path: "/admin" })],
    ["a path with a query", JSON.stringify({ path: "/en?x=1" })],
    ["an oversized body", JSON.stringify({ path: "/en", pad: "x".repeat(1100) })],
  ])("rejects %s with 400", async (_label, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "invalid_path", message: "path must be a store page path." },
    });
    expect(recordPageView).not.toHaveBeenCalled();
  });

  it("rejects a declared oversized body before reading it", async () => {
    const response = await POST(
      request(JSON.stringify({ path: "/en" }), { "content-length": "5000" }),
    );

    expect(response.status).toBe(400);
    expect(recordPageView).not.toHaveBeenCalled();
  });

  it("returns 500 when recording unexpectedly throws", async () => {
    recordPageView.mockRejectedValue(new Error("boom"));

    const response = await POST(request(JSON.stringify({ path: "/en" })));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: "Something went wrong." },
    });
  });
});
