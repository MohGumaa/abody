import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  centsToPriceInput,
  isOwnUploadKey,
  parsePriceToCents,
  parseProductForm,
  productFileKey,
  uploadFileName,
} from "./admin-products";
import { productFileExtension } from "./admin-product-rules";

const valid = {
  name: "Facebook Ads Guide",
  slug: "facebook-ads-guide",
  shortDescription: "A short guide.",
  description: "The full description.",
  price: "49",
  category: "Guides",
  image: "",
  included: "PDF guide\n\n  Checklist  \n",
  nameAr: "",
  categoryAr: "",
  shortDescriptionAr: "",
  descriptionAr: "",
  includedAr: "",
};

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function errorsFor(fields: Record<string, string>) {
  const parsed = parseProductForm(form({ ...valid, ...fields }));
  if (parsed.ok) throw new Error("expected a failure");
  return parsed.fieldErrors;
}

describe("parsePriceToCents", () => {
  it.each([
    ["0.50", 50],
    ["49", 4900],
    ["49.5", 4950],
    ["49.50", 4950],
    [" 1.05 ", 105],
    ["99999.99", 9_999_999],
  ])("reads %s as %i cents", (input, cents) => {
    expect(parsePriceToCents(input)).toBe(cents);
  });

  it.each(["0.49", "0", "1.234", "-1", "1e3", "100000", "", "abc", "1,000", ".5"])(
    "rejects %s",
    (input) => {
      expect(parsePriceToCents(input)).toBeNull();
    },
  );

  it("round-trips with the form's dollar text", () => {
    expect(centsToPriceInput(4950)).toBe("49.50");
    expect(centsToPriceInput(50)).toBe("0.50");
    expect(parsePriceToCents(centsToPriceInput(123_456))).toBe(123_456);
  });
});

describe("parseProductForm", () => {
  it("parses valid input", () => {
    const parsed = parseProductForm(form(valid));
    expect(parsed).toMatchObject({
      ok: true,
      data: {
        name: "Facebook Ads Guide",
        slug: "facebook-ads-guide",
        shortDescription: "A short guide.",
        description: "The full description.",
        priceCents: 4900,
        category: "Guides",
        image: null,
        included: ["PDF guide", "Checklist"],
        nameAr: null,
        categoryAr: null,
        shortDescriptionAr: null,
        descriptionAr: null,
        includedAr: [],
      },
    });
  });

  it("keeps Arabic content and an image", () => {
    const parsed = parseProductForm(
      form({
        ...valid,
        image: "https://cdn.example.com/a.png",
        nameAr: " دليل إعلانات فيسبوك ",
        includedAr: "دليل\nقائمة",
      }),
    );
    expect(parsed.ok && parsed.data).toMatchObject({
      image: "https://cdn.example.com/a.png",
      nameAr: "دليل إعلانات فيسبوك",
      includedAr: ["دليل", "قائمة"],
    });
  });

  it.each(["name", "slug", "shortDescription", "description", "price", "category"])(
    "requires %s",
    (field) => {
      expect(errorsFor({ [field]: "   " })[field as "name"]).toBe("required");
    },
  );

  it("treats a missing field as empty", () => {
    const data = form(valid);
    data.delete("name");
    const parsed = parseProductForm(data);
    expect(!parsed.ok && parsed.fieldErrors.name).toBe("required");
  });

  it("rejects over-length values", () => {
    expect(
      errorsFor({
        name: "x".repeat(121),
        nameAr: "x".repeat(121),
        category: "x".repeat(61),
        shortDescription: "x".repeat(301),
      }),
    ).toEqual({
      name: "too_long",
      nameAr: "too_long",
      category: "too_long",
      shortDescription: "too_long",
    });
    expect(parseProductForm(form({ ...valid, name: "x".repeat(120) })).ok).toBe(true);
  });

  it.each(["Facebook-Ads", "ads guide", "-ads", "ads--guide", "ads_guide"])(
    "rejects the slug %s",
    (slug) => {
      expect(errorsFor({ slug }).slug).toBe("invalid_slug");
    },
  );

  it("rejects an invalid price", () => {
    expect(errorsFor({ price: "0.49" }).price).toBe("invalid_price");
  });

  it.each([
    "http://cdn.example.com/a.png",
    "//evil.example/a.png",
    "javascript:alert(1)",
    "seed/a.png",
  ])("rejects the image %s", (image) => {
    expect(errorsFor({ image }).image).toBe("invalid_image");
  });

  it("accepts a local image path", () => {
    const parsed = parseProductForm(form({ ...valid, image: "/seed/a.svg" }));
    expect(parsed.ok && parsed.data.image).toBe("/seed/a.svg");
  });

  it("limits What's Included lines", () => {
    const lines = (count: number) =>
      Array.from({ length: count }, (_, i) => `Item ${i}`).join("\n");
    expect(parseProductForm(form({ ...valid, included: lines(20) })).ok).toBe(true);
    expect(errorsFor({ included: lines(21) }).included).toBe("too_many_lines");
    expect(errorsFor({ includedAr: "x".repeat(201) }).includedAr).toBe("too_long");
  });

  it("counts a submitted CRLF line break as one character", () => {
    const description = `${"x".repeat(4999)}\r\n${"y".repeat(5000)}`;
    const parsed = parseProductForm(form({ ...valid, description }));
    expect(parsed.ok && parsed.data.description).toBe(
      `${"x".repeat(4999)}\n${"y".repeat(5000)}`,
    );
    const tooLong = `${"x".repeat(5000)}\r\n${"y".repeat(5000)}`;
    expect(errorsFor({ description: tooLong }).description).toBe("too_long");
  });

  it("echoes the typed values on failure", () => {
    const parsed = parseProductForm(form({ ...valid, price: "abc", name: " Guide " }));
    expect(parsed).toMatchObject({
      ok: false,
      values: { price: "abc", name: "Guide", slug: "facebook-ads-guide" },
    });
  });
});

describe("upload file names and keys", () => {
  it("accepts only PDF and ZIP extensions", () => {
    expect(productFileExtension("Guide.PDF")).toBe(".pdf");
    expect(productFileExtension("pack.zip")).toBe(".zip");
    expect(productFileExtension("guide.pdf.exe")).toBeNull();
    expect(productFileExtension("guide")).toBeNull();
    // A dot file has no extension, so it never reaches uploadFileName.
    expect(productFileExtension(".pdf")).toBeNull();
  });

  it.each([
    ["Facebook Ads Guide (v2).pdf", "Facebook-Ads-Guide-v2.pdf"],
    ["../../etc/passwd.pdf", "passwd.pdf"],
    ["C:\\Users\\me\\Guide.PDF", "Guide.pdf"],
    ["دليل.pdf", "download.pdf"],
    ["...hidden.zip", "hidden.zip"],
    ["--.pdf", "download.pdf"],
  ])("makes %s safe as %s", (input, expected) => {
    expect(uploadFileName(input)).toBe(expected);
  });

  it("caps the file name length", () => {
    const name = uploadFileName(`${"a".repeat(300)}.pdf`);
    expect(name).toHaveLength(100);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("builds a per-upload key under the product", () => {
    expect(productFileKey("p1", "0a1b2c3d4e5f6a7b", "Guide.pdf")).toBe(
      "products/p1/0a1b2c3d4e5f6a7b/Guide.pdf",
    );
  });

  it("deletes only this product's own uploads", () => {
    expect(isOwnUploadKey("p1", "products/p1/abc/Guide.pdf")).toBe(true);
    expect(isOwnUploadKey("p1", "seed/facebook-ads-guide.pdf")).toBe(false);
    expect(isOwnUploadKey("p1", "products/p12/abc/Guide.pdf")).toBe(false);
    expect(isOwnUploadKey("p1", null)).toBe(false);
  });
});
