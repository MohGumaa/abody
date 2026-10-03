# Fix: Tajawal for Arabic text on English pages

**Type:** Fix
**Status:** verified
**Branch:** fix/tajawal-for-arabic-text-on-english-pages

## The problem

On English pages, the language switcher's label "العربية" draws in Arial, not
Tajawal.

- English pages use the stack `Geist, "Geist Fallback", Tajawal, …`
  (`--font-body` in `app/globals.css`).
- Geist has no Arabic letters, so the browser moves to the next font.
- `"Geist Fallback"` is the `next/font` metrics fallback, `src: local("Arial")`.
  Arial does have Arabic letters, so Arabic text stops there and never reaches
  Tajawal.
- The switcher link already carries `lang="ar"` (`LanguageSwitcher.tsx`), but no
  CSS rule uses it. Only `:root:lang(ar)` switches the stack, and only for
  Arabic pages.

Observed on `/en`: the link has `lang="ar"` and computes to
`Geist, "Geist Fallback", Tajawal, …`.

## The fix

In `app/globals.css`, add one rule inside `@layer base` that gives any element
marked `lang="ar"` the Arabic stack:
`var(--font-tajawal), var(--font-geist-sans), system-ui, sans-serif`.

- Use `@layer base` so a `font-*` utility on the same element can still
  override it.
- On Arabic pages, `<html lang="ar">` already uses the same Tajawal-first
  stack, so nothing changes there.
- Any later Arabic text inside an English page also gets Tajawal by setting
  `lang="ar"` on it. No component change is needed.

**Must not break:**
- English text on English pages stays Geist, and Arabic pages stay Tajawal.
- The switcher's link behavior, accessible name, and phone-width hidden label.

**Out of scope:**
- English text inside Arabic pages, for example the "English" label on `/ar`.
  It draws in Tajawal's Latin letters, the same as in the mockup.

## Build steps

- [x] **1. Arabic font rule.** Add the `[lang="ar"]` rule in `@layer base` in
  `app/globals.css`.
  **Done when:** on `/en`, the switcher link computes to a stack that starts
  with Tajawal and renders "العربية" in Tajawal. `/ar` body text is still
  Tajawal, and `/en` body text is still Geist. `pnpm lint` and `pnpm build`
  pass.

## Verify

- `pnpm test`, `pnpm lint`, `pnpm build`.
- With `pnpm dev`, open `/en` and hard-reload. "العربية" in the header has the
  same letter shapes as the Arabic text on `/ar`, not the thinner Arial shapes.
  The rest of `/en` still looks the same, and `/ar` is unchanged.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2385,"specSha256":"50bed4b8c2cc0627d7fa33a86af411670769947960139557a87674ccf1937a30","branch":"refs/heads/fix/tajawal-for-arabic-text-on-english-pages","head":"96bb5b9825a2e4412f5a3d8a1df42e414cebc1fb","baseRef":"refs/heads/main","baseCommit":"96bb5b9825a2e4412f5a3d8a1df42e414cebc1fb","sourceTree":"b571eda848dbed77117e6564ad9ef8ce84fd570b","absentOptional":[]} -->
