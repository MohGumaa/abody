# Fix: Clean up service tracking status display

**Type:** Fix
**Status:** verified
**Branch:** fix/clean-up-service-tracking-status-display
**Fixes:** F-17

## The problem

Three display issues from the Playwright check of feature 11, Customer Service
Tracking, on 2026-10-07:

1. **Two status labels per row on Account → Services.** Feature 11 added the
   `ServiceStatusChip` but kept `OnboardingStatus`, which renders its own state
   chip next to the add or update link. So each row says the same thing twice.
   - English, no record: "Details needed" twice.
   - English, `NEW`: "Details received" twice.
   - Arabic, a cancelled service: "تم استلام التفاصيل" (details received) next
     to "ملغاة" (cancelled), which contradicts it.
2. **F-17.** On the service detail page, the messages that ask the customer to
   act have no link of their own. These are the no-record message ("Send your
   details…") and `WAITING_FOR_INFORMATION` ("Please update your details"). The
   only link is in the "Your details" section below.
   (`app/[lang]/account/services/[itemId]/page.tsx`)
3. **The Cancelled step shows a green check,** the same marker as a completed
   step, so a cancellation looks like success.
   (`components/account/ServiceProgress.tsx`)

## The fix

- **List rows.** Give `OnboardingStatus` an optional `showState` prop that
  defaults to `true`. The services list page passes `false`, so the row keeps
  only the link: "Add your details" or "Update your details", with its
  screen-reader service name. `ServiceStatusChip` stays the row's only status
  label. The success page passes nothing and does not change.
- **F-17.** On the detail page, when the customer has to act (no record, or
  `WAITING_FOR_INFORMATION`, which is `onboardingState(status) === "needed"`),
  render the onboarding link right after the status message in the Progress
  section.
  - The label is "Add your details" when there is no record and "Update your
    details" when there is one.
  - The link in the "Your details" section stays as it is.
  - No new dictionary strings.
- **Cancelled marker.** The `cancelled` step uses a danger marker
  (`bg-danger text-white`) with the existing `MinusIcon` instead of the green
  check.
  - Its screen-reader state stays "Done".
  - Every other step's marker is unchanged.

Must not break:

- the success page's "Your services" rows (chip and link);
- the timeline's `aria-current="step"` and screen-reader state text;
- the right-to-left layout;
- the read-only answers.

There is no data, query, access, or dependency change.

## Build steps

1. [x] **Fix the three display issues.** Make the `OnboardingStatus` prop
   change, use it on the list page, add the Progress section link on the detail
   page, and add the cancelled marker in `ServiceProgress`.
   - _Done when:_
     - `pnpm test`, `pnpm lint`, and `pnpm build` pass.
     - In the running app, in `/en` and `/ar`:
       - Account → Services rows show one status chip and the add or update
         link;
       - the detail page shows the onboarding link under the message for no
         record and for `WAITING_FOR_INFORMATION`, and not for `NEW`,
         `IN_PROGRESS`, `COMPLETED`, or `CANCELLED`;
       - a cancelled service's last step has the red minus marker;
       - the success page's services section still shows its state chip.

## Verify

- Sign in as `track.owner@example.test`, the development test data from the
  feature 11 check, and open Account → Services in `/en` and `/ar`. Each row
  should show one status chip.
- Open order #1009's service (no record). "Add your details" appears under
  "Send your details…".
- Set order #1010's service to `WAITING_FOR_INFORMATION`, then to `NEW`, then to
  `CANCELLED`, with the scratch `track-data.ts status` script. Check:
  - the link appears under the message only for `WAITING_FOR_INFORMATION`;
  - `CANCELLED` ends with the red minus marker.
- Open a success page for a paid order with a service. The state chip is still
  there.

## Evidence (2026-10-07)

Automated:

- `pnpm test`: 30 files, 431 tests passed.
- `pnpm lint`: clean.
- `pnpm build`: passed.

Live, with Playwright against `pnpm dev`. Test data was the feature 11 check's
user `track.owner@example.test` and orders #1009 and #1010, with statuses set
by the scratch `track-data.ts` script.

- **Account → Services, `/en` and `/ar`.** Each row shows one status chip. A
  cancelled row shows only "Cancelled" / "ملغاة". The no-record row shows "Add
  your details" plus "Details needed".
- **Detail page, no record, `/en` and `/ar`.** "Add your details" / "أضف تفاصيلك"
  appears in the Progress section.
- **Detail page, `WAITING_FOR_INFORMATION`.** "Update your details" appears under
  the message (`fix-en-waiting.png`).
- **Detail page, `NEW`.** There is no link in Progress. The "Your details" link
  remains.
- **Detail page, `CANCELLED`, `/ar`.** The last step has the red minus marker
  (`bg-danger`, `fix-ar-cancelled-marker.png`), and its screen-reader state is
  still "تمّت" (done).
- **Success page for order #1008.** Fetched with its checkout session id, which
  was not printed: status 200, the "Your services" section still shows its state
  chip and link.

`IN_PROGRESS` and `COMPLETED` were not re-checked live. Their link condition is
the same `onboardingState` check, which is unit-tested in `lib/onboarding.test.ts`.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":5430,"specSha256":"2c74482edea75513ffefdfc2bf03c63636200cfb0bac5774dd4c23b87235014b","branch":"refs/heads/fix/clean-up-service-tracking-status-display","head":"cfa1bd87b8669760e235a543b869f6adbed96951","baseRef":"refs/heads/main","baseCommit":"cfa1bd87b8669760e235a543b869f6adbed96951","sourceTree":"bcbaa303800a1e93538e59dc674026296b0d2ce3","absentOptional":[]} -->
