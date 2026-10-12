# Fix: Image links from Google Drive and Mega

**Type:** Fix
**Status:** verified
**Branch:** fix/image-links-from-google-drive-and-mega

## The problem

Admins paste share links into a product or service's image field, and the
store shows a broken image (or nothing).

- **Google Drive:** a share link such as
  `https://drive.google.com/file/d/<id>/view?usp=sharing` opens Drive's preview
  page (`text/html`), not the image. `publicImageSrc` (`lib/catalog.ts`) accepts
  it because it is a valid `https://` URL, so the `<img>` breaks. Live example:
  the Lead Generation Campaign service.
- **Mega (`mega.nz`):** files are end-to-end encrypted. The key sits in the
  `#` fragment and only Mega's own page can decrypt them, so no Mega link can
  ever be an image source. The admin form accepts them anyway.

## The fix

All image rendering and the admin image validation already go through
`publicImageSrc` (`ProductCover`, `ProductImage`, `socialImageSrc` in
`lib/seo.ts`, and `parseProductForm` in `lib/admin-products.ts`). Repair it
there:

- **Drive share links render as the image.** In `publicImageSrc`, when an
  `https` URL's host is `drive.google.com` and it names a file ID, as
  `/file/d/<id>/...`, or as `?id=<id>` on `/open` or `/uc`, return
  `https://lh3.googleusercontent.com/d/<id>`. (Checked: this returns
  `image/jpeg` for the live Drive file; the `/view` link returns `text/html`.)
  The file ID must match `[A-Za-z0-9_-]+`; otherwise the URL is returned
  unchanged, as today. The stored value is not rewritten, so the existing
  Lead Generation Campaign row starts working with no data change.
- **Mega links are rejected with a clear message.** `publicImageSrc` returns
  `null` for host `mega.nz` or `mega.co.nz` (and their subdomains), so the
  store shows the placeholder. `parseProductForm` reports a new
  `unsupported_image_host` error instead of `invalid_image` for those hosts.
  `ProductForm` shows: "Mega links can't be shown as images. Upload the image
  somewhere that gives a direct link, such as Google Drive (shared with anyone
  with the link)." Add the code to the error union in `lib/admin-product-rules.ts`.
- Everything else stays as today: root-relative paths, other `https` URLs, the
  tab/newline and protocol-relative rejections (24a F-04), and the `.svg`
  exclusion in `socialImageSrc`.
- No new dependency, no `next/image` remote config, no upload feature.

## Build steps

1. [x] **Normalize Drive links and reject Mega in `publicImageSrc`, with form
   messaging.** Update `lib/catalog.ts`, `lib/admin-products.ts`,
   `lib/admin-product-rules.ts`, and `components/admin/ProductForm.tsx`. Add
   unit tests in `lib/catalog.test.ts` (Drive `/file/d/<id>/view`, `/open?id=`,
   `/uc?id=`, a Drive URL with no ID left unchanged, Mega `#` link → `null`) and
   `lib/admin-products.test.ts` (Mega → `unsupported_image_host`, Drive share
   link accepted and stored as entered).
   - **Done when:** `pnpm test`, `pnpm lint`, and `pnpm build` pass, and the
     new tests cover each case above.

## Verify

- Run `pnpm dev` and open `/en/services/lead-generation-campaign`. The cover
  shows the Drive image, and so do its store card and cart line.
- In admin, edit Facebook Ads Guide and save a `mega.nz` link. The form shows
  the Mega message and does not save.
- Save the Drive share link on Facebook Ads Guide instead. It saves, and the
  product page shows the image.
- An ordinary `https://` image URL and a `/seed/...` path still show as before.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3506,"specSha256":"b3bfbba87990bafe4fc4df6ca0a684e5ac4dd23af28d9bfeb2def4e28f349d2f","branch":"refs/heads/fix/image-links-from-google-drive-and-mega","head":"ceb8d076fe9d38ce5e04cd38b24f30f5726e2f33","baseRef":"refs/heads/main","baseCommit":"ceb8d076fe9d38ce5e04cd38b24f30f5726e2f33","sourceTree":"eefdf016dca4daa4a96161248813756e2c7f5c0b","absentOptional":[]} -->
