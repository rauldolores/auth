# @kontrolia/ui

## 1.1.1

### Patch Changes

- 61e3531: `GoogleLoginButton`/`MicrosoftLoginButton` (and `LoginForm`/`RegisterForm`, which render them) now accept an optional `redirectTo` prop, forwarded to `loginWithOAuth()`. Previously there was no way to preserve a `redirect_to` destination through the Google/Microsoft login path — the OAuth buttons always fell back to the SDK's bare default (`${origin}/auth/callback`, no onward target), silently dropping wherever the caller was trying to go.
- Updated dependencies [1aa8b7f]
  - @kontrolia/react@1.3.0

## 1.1.0

### Minor Changes

- aab1253: Added `Dialog` and `ConfirmDialog` components, built on `@radix-ui/react-dialog` (new dependency — the package's first, no headless UI library existed anywhere in the repo before this). Replaces `window.confirm()`/inline-in-page forms across admin-panel with on-brand modals styled to match `Card`'s existing tokens, while preserving the keyboard/Escape/focus-trap/screen-reader behavior a prior professional-review audit already signed off on for the native dialogs being replaced.

## 1.0.3

### Patch Changes

- @kontrolia/react@1.2.1

## 1.0.2

### Patch Changes

- Updated dependencies [9105753]
- Updated dependencies [1c3cd5a]
- Updated dependencies [d247ebb]
  - @kontrolia/shared@1.1.0
  - @kontrolia/react@1.2.0

## 1.0.1

### Patch Changes

- Updated dependencies [564595f]
  - @kontrolia/react@1.1.0
