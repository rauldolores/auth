---
"@kontrolia/ui": minor
---

Added `Dialog` and `ConfirmDialog` components, built on `@radix-ui/react-dialog` (new dependency — the package's first, no headless UI library existed anywhere in the repo before this). Replaces `window.confirm()`/inline-in-page forms across admin-panel with on-brand modals styled to match `Card`'s existing tokens, while preserving the keyboard/Escape/focus-trap/screen-reader behavior a prior professional-review audit already signed off on for the native dialogs being replaced.
