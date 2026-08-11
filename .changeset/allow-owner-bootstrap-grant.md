---
"@kontrolia/db": patch
---

Fixed a regression from migration 0028: creating a new organization was broken entirely, since granting its first Owner role now required the caller to already be an Owner — a genuine chicken-and-egg problem for a brand-new org with no Owner yet. Migration 0031 allows the grant when the target organization currently has zero active Owners (only ever true for a brand-new org, since 0025-0027 already prevent an existing org's Owner count from ever reaching zero any other way).
