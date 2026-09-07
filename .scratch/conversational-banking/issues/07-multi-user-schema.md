# 07 — Multi-User Schema, Products Table & Seed Data

**What to build:** Database foundation for 3 users (Prashant/Umesh/Priyank) with distinct financial products, auth preferences, RLS policies, and a customer_products table for multi-product statements.

**Blocked by:** None — all previous issues are done.

**Status:** done

## Acceptance criteria

- [x] Migration 006 enables RLS on all tables with row-level policies using `auth.uid()`
- [x] Migration 006 adds `auth_preference` column to `customer_profiles`
- [x] Migration 007 creates `customer_products` table with product types (accounts, credit cards, loans)
- [x] Migration 008 adds `set_customer_pin` RPC function
- [x] Seed data creates 3 users with different PINs (1234/5678/9012) and auth preferences (PIN/BIOMETRIC/CREDENTIALS)
- [x] Each user has distinct accounts, cards, transactions, and products
- [x] Shared types export `CustomerProduct`, `AuthPreference`, `CustomerProfile`, `AuthCredentials`
