---
"@kontrolia/db": patch
---

Adds audit-log triggers for creating/deleting a role and granting/revoking a permission on a role — previously the only mutations in the product with zero audit trail. Matches the existing "the database logs it, not application code" pattern (migrations 0013/0024).
