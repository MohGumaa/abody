# Fix: One show/hide toggle for password and confirm fields

**Type:** Fix
**Status:** verified
**Branch:** fix/one-show-hide-toggle-for-password-and-confirm-fields

## The problem

Wherever a form asks for a new password and its confirmation, each field has
its own eye button (`PasswordInput` in `components/auth/AuthForm.tsx` keeps its
own `visible` state). Users have to reveal the two fields separately to compare
what they typed, and the two buttons sit side by side doing the same job.

Affected forms:

- Register (`AuthForm`, `mode === "register"`): `password` + `confirm`.
- Account settings `PasswordForm` (`components/account/SettingsForms.tsx`):
  `new-password` + `confirm-password`.

Not affected: sign-in's single password field, and every "current password"
field (profile form and password form). Those keep their own toggle.

## The fix

Let a pair of `PasswordInput`s share one visibility state, with the button only
on the first field:

- `PasswordInput` accepts optional controlled `visible` / `onVisibleChange`
  props; without them it keeps its current local state, so existing single-field
  uses don't change.
- It also accepts a way to render without the toggle button (and then uses the
  narrower end padding, since there is no button to make room for).
- The toggle on the main field sets `aria-controls` to both input ids so
  assistive tech knows it reveals both.
- Register and the settings password form own the shared `useState` and pass it
  to the new-password and confirm fields; the confirm field renders no button.

Must not break: typed values survive toggling (only `type` changes); labels
still swap between `showPassword` / `hidePassword`; `aria-pressed` still
reflects the state; RTL layout (button on inline end, lock icon on inline
start); focus-on-error after a failed submit. No new dictionary strings, no new
component file, no dependency.

## Build steps

1. [x] **Share visibility across the password pair.** Extend `PasswordInput` with
   the optional controlled state and no-toggle mode, then wire it into the
   register form and the settings password form.
   - _Done when:_ on `/en/register` and `/ar/register`, and on the account
     settings password form, there is exactly one eye button for the
     new-password + confirm pair; clicking it reveals and hides both fields
     together; current-password and sign-in fields still have their own
     independent toggle; `pnpm lint` and `pnpm build` pass.

## Verify

- Register (EN and AR): type into Password and Confirm, click the single eye
  button, both show plain text; click again, both are masked; values unchanged.
  Confirm has no button of its own.
- Account settings > Change password: same behavior for New password + Confirm;
  Current password still toggles on its own.
- Sign in: the single password field toggles as before.
- Keyboard: Tab reaches the one toggle; Space/Enter flips both fields; screen
  reader announces the pressed state.
- Submit register with mismatched passwords: focus still moves to the Confirm
  field.


<!-- blueprint:completion {"schemaVersion":1,"specBytes":3054,"specSha256":"8c4086ffe5d3b705f79489ae3b6513de7d32b418eee165c87e8d7763a528417c","branch":"refs/heads/fix/one-show-hide-toggle-for-password-and-confirm-fields","head":"98645d3d2a288e5be8d2acf01563abbcdba6f4db","baseRef":"refs/heads/main","baseCommit":"98645d3d2a288e5be8d2acf01563abbcdba6f4db","sourceTree":"02307ba5aa11d4c35851699e491593dbbf06f6f2","absentOptional":[]} -->
