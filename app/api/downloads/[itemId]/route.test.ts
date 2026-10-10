import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findDownload, openStoredFile, signedStoredFileUrl, bucketConfig } =
  vi.hoisted(() => ({
    findDownload: vi.fn(),
    openStoredFile: vi.fn(),
    signedStoredFileUrl: vi.fn(),
    bucketConfig: vi.fn(),
  }));

vi.mock("@/lib/downloads", () => ({
  findDownload,
  openStoredFile,
  signedStoredFileUrl,
}));
vi.mock("@/lib/object-storage", () => ({ bucketConfig }));

import { GET } from "./route";

const SESSION_ID = "cs_test_abc123";

function call(itemId: string, sessionId: string | null = SESSION_ID) {
  const query = sessionId === null ? "" : `?session_id=${sessionId}`;
  return GET(
    new NextRequest(`http://localhost/api/downloads/${itemId}${query}`),
    { params: Promise.resolve({ itemId }) },
  );
}

function fileOf(text: string) {
  const bytes = new TextEncoder().encode(text);
  return {
    size: bytes.length,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}

async function expectNotFound(response: Response) {
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: "not_found", message: "Download not found" },
  });
}

beforeEach(() => {
  findDownload.mockReset();
  openStoredFile.mockReset();
  signedStoredFileUrl.mockReset();
  bucketConfig.mockReset().mockReturnValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/downloads/[itemId]", () => {
  it("streams the file with download headers", async () => {
    findDownload.mockResolvedValue("seed/facebook-ads-guide.pdf");
    openStoredFile.mockResolvedValue(fileOf("%PDF-1.4"));

    const response = await call("item_1");

    expect(response.status).toBe(200);
    expect(findDownload).toHaveBeenCalledWith(SESSION_ID, "item_1");
    expect(openStoredFile).toHaveBeenCalledWith("seed/facebook-ads-guide.pdf");
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "content-type": "application/pdf",
      "content-length": "8",
      "content-disposition": 'attachment; filename="facebook-ads-guide.pdf"',
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    });
    expect(await response.text()).toBe("%PDF-1.4");
  });

  it.each([
    ["missing", null],
    ["malformed", "not-a-session"],
    ["wrong prefix", "pi_test_abc123"],
  ])("returns 404 without a lookup for a %s session id", async (_, id) => {
    await expectNotFound(await call("item_1", id));
    expect(findDownload).not.toHaveBeenCalled();
  });

  it("returns 404 without a lookup for an over-long item id", async () => {
    await expectNotFound(await call("a".repeat(65)));
    expect(findDownload).not.toHaveBeenCalled();
  });

  it("returns 404 when the lookup denies access", async () => {
    findDownload.mockResolvedValue(null);

    await expectNotFound(await call("item_1"));
    expect(openStoredFile).not.toHaveBeenCalled();
  });

  it("returns 500 when the granted file is missing", async () => {
    findDownload.mockResolvedValue("seed/gone.pdf");
    openStoredFile.mockResolvedValue(null);

    const response = await call("item_1");

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).not.toContain(SESSION_ID);
    expect(logged).not.toContain("seed/gone.pdf");
  });

  it("returns 500 when the lookup throws", async () => {
    findDownload.mockRejectedValue(new Error("db down"));

    const response = await call("item_1");

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });
});

describe("GET /api/downloads/[itemId] with a bucket", () => {
  const SIGNED =
    "https://account123.r2.cloudflarestorage.com/abody-files/seed/facebook-ads-guide.pdf?X-Amz-Signature=abc";

  beforeEach(() => {
    bucketConfig.mockReturnValue({ bucket: "abody-files" });
  });

  it("redirects a granted item to its signed link", async () => {
    findDownload.mockResolvedValue("seed/facebook-ads-guide.pdf");
    signedStoredFileUrl.mockResolvedValue(SIGNED);

    const response = await call("item_1");

    expect(response.status).toBe(302);
    expect(signedStoredFileUrl).toHaveBeenCalledWith("seed/facebook-ads-guide.pdf");
    expect(openStoredFile).not.toHaveBeenCalled();
    expect(Object.fromEntries(response.headers)).toMatchObject({
      location: SIGNED,
      "cache-control": "private, no-store",
      "referrer-policy": "no-referrer",
    });
  });

  it("returns the same 404 without touching storage when access is denied", async () => {
    findDownload.mockResolvedValue(null);

    await expectNotFound(await call("item_1"));
    await expectNotFound(await call("item_1", "not-a-session"));
    expect(signedStoredFileUrl).not.toHaveBeenCalled();
  });

  it("returns 500 without logging secrets when the object is missing", async () => {
    findDownload.mockResolvedValue("seed/gone.pdf");
    signedStoredFileUrl.mockResolvedValue(null);

    const response = await call("item_1");

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain("item_1");
    expect(logged).not.toContain(SESSION_ID);
    expect(logged).not.toContain("seed/gone.pdf");
  });

  it("returns 500 when storage is misconfigured", async () => {
    findDownload.mockResolvedValue("seed/facebook-ads-guide.pdf");
    bucketConfig.mockImplementation(() => {
      throw new Error("Object storage is partly configured; missing S3_REGION");
    });

    const response = await call("item_1");

    expect(response.status).toBe(500);
    expect(signedStoredFileUrl).not.toHaveBeenCalled();
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).not.toContain(SESSION_ID);
  });

  it("returns 500 when signing fails", async () => {
    findDownload.mockResolvedValue("seed/facebook-ads-guide.pdf");
    signedStoredFileUrl.mockRejectedValue(new Error("network down"));

    const response = await call("item_1");

    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("internal_error");
  });
});
