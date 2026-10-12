# Fix: Reject an EMAIL_FROM without an address

**Type:** Fix
**Status:** verified
**Branch:** fix/reject-an-email-from-without-an-address

## The problem

`emailConfig()` in `lib/email.ts` accepts any non-empty `EMAIL_FROM`. A value
with no address, such as `Abody App <abody.com>`, passes, and every send fails
at Resend with a 422. Because emails go out after the response in `after()`,
the only sign is a vague `… email failed: Resend answered 422` line in the
server log. Customers see the normal page and get no email. Debugging found
this behind "reset password still not working" locally: a reset link was
created, but the email was never sent. Order and service emails use the same
sender, so they fail the same way.

## The fix

- In `emailConfig()`, after the existing "both or neither" check, accept
  `EMAIL_FROM` only in the two forms Resend takes: `you@domain.tld`, or
  `Name <you@domain.tld>` with a name and the address inside angle brackets.
  The address is checked with the existing `isValidEmail` rule from
  `lib/auth.ts`. Otherwise throw `EmailConfigError` with a message that names
  the variable and the expected shape, but not the value: `Email is
  misconfigured; EMAIL_FROM must be "you@domain" or "Name <you@domain>"`.
- No caller changes. Every sender (`order-notifications`,
  `service-notifications`, `password-reset-notifications`) already catches the
  error and logs its message, so the log now names the real problem.
- **Must not break:** email off when neither variable is set; the existing
  partial-configuration error; valid senders such as `Abody <orders@abody.com>`
  and `orders@abody.com`; and the rule that logs never include addresses.
- This does not fix the user's `.env`. The user still sets a real
  `EMAIL_FROM` on a Resend-verified domain locally and in Vercel.

## Build steps

- [x] **1. Validate the sender format in `emailConfig()`.** Add the check and
  extend `lib/email.test.ts`:
  - `Abody <orders@abody.com>` and `orders@abody.com` are accepted.
  - `Abody App <abody.com>`, `Abody`, `<orders@abody.com` (missing `>`), and
    `orders@abody` are each rejected with `EmailConfigError`.
  - The error message contains `EMAIL_FROM` but not the rejected value.

  *Done when:* `pnpm exec vitest run lib/email.test.ts` passes, then `pnpm test`
  and `pnpm lint` pass with every existing notification test unchanged.

## Verify

- `pnpm test`, `pnpm lint`, and `pnpm build` pass (stop the dev server before
  building).
- Manual: with the current bad `EMAIL_FROM`, request a reset link. The server
  log shows `… email failed: Email is misconfigured; EMAIL_FROM must be …`
  instead of `Resend answered 422`. Then set a full address on a verified
  domain, restart `pnpm dev`, request again, and the email arrives.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":2778,"specSha256":"9a5e342f8d7650222e9aa74a68b8a927597f74d1a8aa4c2f24559ce6e40b2358","branch":"refs/heads/fix/reject-an-email-from-without-an-address","head":"06783394e2193ec0dc948933f8d02e8475721fab","baseRef":"refs/heads/main","baseCommit":"06783394e2193ec0dc948933f8d02e8475721fab","sourceTree":"8396a0246bfc68e1c412b30134fce4ef9b442e77","absentOptional":[]} -->

## Findings

- None (no new findings; open entries, including F-45 fixed and F-47 open, unchanged)
