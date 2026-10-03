import { describe, expect, it } from "vitest";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { en } from "@/lib/i18n/dictionaries/en";
import { formatItemCount } from "@/lib/i18n/plural";

describe("formatItemCount", () => {
  it("uses the singular and plural in English", () => {
    expect(formatItemCount("en", 1, en.cart.itemCount)).toBe("1 item");
    expect(formatItemCount("en", 3, en.cart.itemCount)).toBe("3 items");
    expect(formatItemCount("en", 0, en.cart.itemCount)).toBe("0 items");
  });

  it("uses each Arabic plural form with Latin digits", () => {
    const forms = ar.cart.itemCount;
    expect(formatItemCount("ar", 0, forms)).toBe("لا عناصر");
    expect(formatItemCount("ar", 1, forms)).toBe("عنصر واحد");
    expect(formatItemCount("ar", 2, forms)).toBe("عنصران");
    expect(formatItemCount("ar", 3, forms)).toBe("3 عناصر");
    expect(formatItemCount("ar", 10, forms)).toBe("10 عناصر");
    expect(formatItemCount("ar", 11, forms)).toBe("11 عنصراً");
    expect(formatItemCount("ar", 100, forms)).toBe("100 عنصر");
  });
});
