-- KontrolIA Auth — bootstrap schema
-- All KontrolIA tables live in a dedicated `kontrolia` schema so this migration
-- is safe to run against a Supabase project that already has application
-- tables in `public` (existing-project install path).

create schema if not exists kontrolia;

create extension if not exists pgcrypto with schema public;

comment on schema kontrolia is 'KontrolIA Auth — organizations, RBAC and application registry. Isolated from the host project public schema.';
