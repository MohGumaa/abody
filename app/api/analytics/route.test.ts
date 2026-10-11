import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordPageView, reserveRateLimit } = vi.hoisted(() => ({
  recordPageView: vi.fn(),
  reserveRateLimit: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({ recordPageView }));
vi.mock("@/lib/rate-limit", () => ({ clientKey: () => "ip", reserveRateLimit }));

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
  reserveRateLimit.mockReset().mockResolvedValue(true);
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
    expect(reserveRateLimit).not.toHaveBeenCalled();
  });

  it("counts real bytes, not characters", async () => {
    // 600 two-byte characters: under 1024 UTF-16 units, over 1024 bytes.
    const body = JSON.stringify({ path: "/en", pad: "é".repeat(600) });
    expect(body.length).toBeLessThan(1024);

    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(recordPageView).not.toHaveBeenCalled();
  });

  it("stops reading a body sent without Content-Length once it passes the limit", async () => {
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls > 1000) controller.close();
        else controller.enqueue(new Uint8Array(256).fill(0x20));
      },
    });
    const response = await POST(
      new Request("http://localhost/api/analytics", {
        method: "POST",
        body: stream,
        duplex: "half",
      } as RequestInit),
    );

    expect(response.status).toBe(400);
    expect(pulls).toBeLessThan(10);
    expect(recordPageView).not.toHaveBeenCalled();
  });

  it("rejects a body that is not UTF-8", async () => {
    const response = await POST(
      new Request("http://localhost/api/analytics", {
        method: "POST",
        body: new Uint8Array([0x7b, 0xff, 0x7d]),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 429 without recording when the visitor is over the limit", async () => {
    reserveRateLimit.mockResolvedValue(false);

    const response = await POST(request(JSON.stringify({ path: "/en" })));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: { code: "rate_limited", message: "Too many requests." },
    });
    expect(reserveRateLimit).toHaveBeenCalledWith("analytics", "ip");
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
