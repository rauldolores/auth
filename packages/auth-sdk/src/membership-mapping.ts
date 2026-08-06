import type { KontroliaMembershipWithOrganization, KontroliaOrganization } from "@kontrolia/shared";

interface MembershipRow {
  id: string;
  organization_id: string;
  status: "active" | "invited" | "suspended";
  organization: KontroliaOrganization | KontroliaOrganization[] | null;
  membership_roles: { role: { slug: string } | { slug: string }[] | null }[] | null;
}

/**
 * supabase-js's typing for a to-one embed (organization, role) varies
 * between "the object" and "an array of one" depending on how it infers the
 * foreign key relationship — normalize both so callers don't have to think
 * about it.
 */
function firstOrSelf<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : (value ?? undefined);
}

/**
 * Maps the raw rows of a `memberships` query (selected with the nested
 * `organization:organizations(...)` / `membership_roles(role:roles(slug))`
 * embeds) into KontroliaMembershipWithOrganization — shared by
 * client.ts's getMemberships() (browser session) and server.ts's
 * listMemberships() (bearer token), which run the identical query shape
 * authenticated two different ways.
 */
export function mapMembershipRows(rows: MembershipRow[]): KontroliaMembershipWithOrganization[] {
  return rows.flatMap((row) => {
    const organization = firstOrSelf(row.organization);
    if (!organization) return [];
    const roles = (row.membership_roles ?? [])
      .map((mr) => firstOrSelf(mr.role)?.slug)
      .filter((slug): slug is string => Boolean(slug));
    return [{ id: row.id, organizationId: row.organization_id, status: row.status, roles, organization }];
  });
}
