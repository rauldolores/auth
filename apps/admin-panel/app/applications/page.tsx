"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card, ConfirmDialog, Dialog } from "@kontrolia/ui";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

interface ApplicationRow {
  id: string;
  name: string;
  slug: string;
  environment: string;
  owner_organization_id: string | null;
  homepage_url: string | null;
  oauth_client_id: string | null;
  permissionCount: number;
}

interface OAuthClient {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
}

interface ApplicationApiKey {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  createdBy: string | null;
  createdAt: string;
}

const APPLICATIONS_PAGE_SIZE = 50;

type ConfirmAction =
  | { kind: "disable"; app: ApplicationRow }
  | { kind: "claim"; app: ApplicationRow }
  | { kind: "revoke-key"; app: ApplicationRow; key: ApplicationApiKey };

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    const first = parts[0][0] ?? "";
    const second = parts[1][0] ?? "";
    return (first + second).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const GRADIENTS = [
  "k-bg-gradient-to-br k-from-indigo-600 k-to-violet-700 k-text-white",
  "k-bg-gradient-to-br k-from-blue-600 k-to-cyan-600 k-text-white",
  "k-bg-gradient-to-br k-from-emerald-600 k-to-teal-700 k-text-white",
  "k-bg-gradient-to-br k-from-purple-600 k-to-pink-600 k-text-white",
  "k-bg-gradient-to-br k-from-amber-500 k-to-orange-600 k-text-white",
  "k-bg-gradient-to-br k-from-rose-600 k-to-red-700 k-text-white",
];

function getAvatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index] ?? "k-bg-gradient-to-br k-from-indigo-600 k-to-violet-700 k-text-white";
}

// --- Inline SVG Icons ---
function AppIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function CheckCircleIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function PlusCircleIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function KeyIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function ShieldCheckIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function ExternalLinkIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  );
}

function SearchIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function CopyIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function CheckIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function EditIcon({ className = "k-w-3.5 k-h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function XIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function AlertTriangleIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function InfoIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function LayoutGridIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ListIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function LockIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function SpinnerIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={`k-animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="k-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="k-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

export default function ApplicationsPage() {
  const { organization, hasRole, isPlatformAdmin, getToken } = useAuth();
  const [enabled, setEnabled] = useState<ApplicationRow[] | null>(null);
  const [available, setAvailable] = useState<ApplicationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const canManage = hasRole(["owner", "admin"]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [oauthClients, setOauthClients] = useState<Map<string, OAuthClient>>(new Map());
  const [oauthDialogApp, setOauthDialogApp] = useState<ApplicationRow | null>(null);
  const [oauthName, setOauthName] = useState("");
  const [oauthRedirectUris, setOauthRedirectUris] = useState("");
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthSaving, setOauthSaving] = useState(false);
  const [oauthLinkClientId, setOauthLinkClientId] = useState("");
  const [oauthLinking, setOauthLinking] = useState(false);
  const [apiKeysDialogApp, setApiKeysDialogApp] = useState<ApplicationRow | null>(null);
  const [apiKeys, setApiKeys] = useState<ApplicationApiKey[] | null>(null);
  const [apiKeysError, setApiKeysError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiresAt, setNewKeyExpiresAt] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [newPlaintextKey, setNewPlaintextKey] = useState<string | null>(null);

  // Filters & UI view state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterRoleTab] = useState<"enabled" | "available" | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [showInfoBanner, setShowInfoBanner] = useState(true);

  useEffect(() => {
    void (async () => {
      const isAdmin = await isPlatformAdmin();
      setPlatformAdmin(isAdmin);
      if (isAdmin) await loadOauthClients();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadOauthClients() {
    const token = await getToken();
    const response = await fetch(`${AUTH_SERVER_URL}/api/oauth-clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const data = (await response.json().catch(() => ({}))) as { clients?: OAuthClient[] };
    setOauthClients(new Map((data.clients ?? []).map((client) => [client.client_id, client])));
  }

  async function loadApplications(orgId: string, offset = 0, append = false) {
    const supabase = createKontroliaSchemaClient();

    const [{ data: appPage }, { data: enabledRows }] = await Promise.all([
      supabase
        .from("applications")
        .select("id, name, slug, environment, owner_organization_id, homepage_url, oauth_client_id")
        .order("name")
        .range(offset, offset + APPLICATIONS_PAGE_SIZE - 1),
      supabase
        .from("application_organizations")
        .select("application_id")
        .eq("organization_id", orgId)
        .returns<{ application_id: string }[]>(),
    ]);

    const enabledIds = new Set((enabledRows ?? []).map((row) => row.application_id));
    const page = appPage ?? [];

    const { data: permissionRows } = await supabase
      .from("permissions")
      .select("application_id")
      .in(
        "application_id",
        page.map((app) => app.id),
      )
      .returns<{ application_id: string }[]>();

    const counts = new Map<string, number>();
    for (const permission of permissionRows ?? []) {
      counts.set(permission.application_id, (counts.get(permission.application_id) ?? 0) + 1);
    }

    const withCounts = page.map((app) => ({ ...app, permissionCount: counts.get(app.id) ?? 0 }));

    setEnabled((current) => {
      const next = withCounts.filter((app) => enabledIds.has(app.id));
      return append ? [...(current ?? []), ...next] : next;
    });
    setAvailable((current) => {
      const next = withCounts.filter((app) => !enabledIds.has(app.id));
      return append ? [...(current ?? []), ...next] : next;
    });
    setHasMore(page.length === APPLICATIONS_PAGE_SIZE);
  }

  useEffect(() => {
    if (organization) void loadApplications(organization.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  async function handleLoadMore() {
    if (!organization) return;
    setLoadingMore(true);
    await loadApplications(organization.id, (enabled?.length ?? 0) + (available?.length ?? 0), true);
    setLoadingMore(false);
  }

  async function handleEnable(applicationId: string) {
    if (!organization) return;
    setError(null);
    setPendingId(applicationId);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: insertError } = await supabase
        .from("application_organizations")
        .insert({ application_id: applicationId, organization_id: organization.id });
      if (insertError) throw insertError;
      await loadApplications(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo habilitar la aplicación.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDisable(applicationId: string) {
    if (!organization) return;
    setError(null);
    setPendingId(applicationId);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: deleteError } = await supabase
        .from("application_organizations")
        .delete()
        .eq("application_id", applicationId)
        .eq("organization_id", organization.id);
      if (deleteError) throw deleteError;
      await loadApplications(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo deshabilitar la aplicación.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleSaveUrl(applicationId: string) {
    setError(null);
    setPendingId(applicationId);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: updateError } = await supabase
        .from("applications")
        .update({ homepage_url: urlDraft.trim() || null })
        .eq("id", applicationId);
      if (updateError) throw updateError;
      setEditingUrlId(null);
      if (organization) await loadApplications(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la URL.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleClaim(app: ApplicationRow) {
    if (!organization) return;
    setError(null);
    setPendingId(app.id);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/applications/claim`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: app.id, organizationId: organization.id }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo reclamar la aplicación.");
      }
      await loadApplications(organization.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reclamar la aplicación.");
    } finally {
      setPendingId(null);
    }
  }

  async function loadApiKeys(app: ApplicationRow) {
    setApiKeysError(null);
    setApiKeys(null);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/applications/${app.id}/keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await response.json().catch(() => null)) as { keys?: ApplicationApiKey[]; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "No se pudieron cargar las API Keys.");
      setApiKeys(data?.keys ?? []);
    } catch (err) {
      setApiKeysError(err instanceof Error ? err.message : "No se pudieron cargar las API Keys.");
    }
  }

  function openApiKeysDialog(app: ApplicationRow) {
    setApiKeysDialogApp(app);
    setNewPlaintextKey(null);
    setNewKeyName("");
    setNewKeyExpiresAt("");
    void loadApiKeys(app);
  }

  async function handleCreateKey(app: ApplicationRow) {
    if (!organization || !newKeyName.trim()) return;
    setApiKeysError(null);
    setCreatingKey(true);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/applications/${app.id}/keys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          name: newKeyName.trim(),
          expiresAt: newKeyExpiresAt ? new Date(newKeyExpiresAt).toISOString() : null,
        }),
      });
      const data = (await response.json().catch(() => null)) as { apiKey?: string; error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "No se pudo crear la clave.");
      setNewPlaintextKey(data?.apiKey ?? null);
      setNewKeyName("");
      setNewKeyExpiresAt("");
      await loadApiKeys(app);
    } catch (err) {
      setApiKeysError(err instanceof Error ? err.message : "No se pudo crear la clave.");
    } finally {
      setCreatingKey(false);
    }
  }

  async function handleRevokeKey(app: ApplicationRow, key: ApplicationApiKey) {
    setApiKeysError(null);
    setRevokingKeyId(key.id);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/applications/${app.id}/keys/${key.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "No se pudo revocar la clave.");
      }
      await loadApiKeys(app);
    } catch (err) {
      setApiKeysError(err instanceof Error ? err.message : "No se pudo revocar la clave.");
    } finally {
      setRevokingKeyId(null);
    }
  }

  function openOauthDialog(app: ApplicationRow) {
    const existing = app.oauth_client_id ? oauthClients.get(app.oauth_client_id) : null;
    setOauthName(existing?.client_name ?? app.name);
    setOauthRedirectUris(existing?.redirect_uris.join("\n") ?? "");
    setOauthError(null);
    setOauthLinkClientId("");
    setOauthDialogApp(app);
  }

  /**
   * Migration 0036 added applications.oauth_client_id but any GoTrue OAuth
   * client created earlier (via the old standalone /oauth-clients page)
   * predates the link and stays unlinked — the dialog would otherwise always
   * offer "create new" even when a matching client already exists, leaving
   * an app with two separate OAuth clients if the operator didn't notice.
   * Lets an admin point an application at an already-existing, unlinked
   * client instead of registering a duplicate one.
   */
  async function handleLinkExistingOauthClient() {
    if (!oauthDialogApp || !oauthLinkClientId) return;
    setOauthError(null);
    setOauthLinking(true);
    try {
      const supabase = createKontroliaSchemaClient();
      const { error: updateError } = await supabase
        .from("applications")
        .update({ oauth_client_id: oauthLinkClientId })
        .eq("id", oauthDialogApp.id);
      if (updateError) throw updateError;

      await loadOauthClients();
      if (organization) await loadApplications(organization.id);
      setOauthDialogApp(null);
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : "No se pudo vincular el cliente OAuth.");
    } finally {
      setOauthLinking(false);
    }
  }

  async function handleSaveOauthClient() {
    if (!oauthDialogApp || !organization) return;
    setOauthError(null);
    setOauthSaving(true);
    try {
      const token = await getToken();
      const redirectUris = oauthRedirectUris
        .split("\n")
        .map((uri) => uri.trim())
        .filter(Boolean);
      const isEdit = !!oauthDialogApp.oauth_client_id;
      const response = await fetch(
        `${AUTH_SERVER_URL}/api/oauth-clients${isEdit ? `?clientId=${oauthDialogApp.oauth_client_id}` : ""}`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ client_name: oauthName, redirect_uris: redirectUris }),
        },
      );
      const data = (await response.json()) as { client_id?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudo guardar el cliente OAuth.");

      if (!isEdit && data.client_id) {
        const supabase = createKontroliaSchemaClient();
        const { error: updateError } = await supabase
          .from("applications")
          .update({ oauth_client_id: data.client_id })
          .eq("id", oauthDialogApp.id);
        if (updateError) throw updateError;
      }

      await loadOauthClients();
      await loadApplications(organization.id);
      setOauthDialogApp(null);
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : "No se pudo guardar el cliente OAuth.");
    } finally {
      setOauthSaving(false);
    }
  }

  if (!organization) {
    return (
      <Card className="k-p-12 k-text-center k-flex k-flex-col k-items-center k-justify-center k-my-8">
        <div className="k-w-16 k-h-16 k-rounded-2xl k-bg-primary/10 k-flex k-items-center k-justify-center k-text-primary k-mb-4">
          <AppIcon className="k-w-8 k-h-8" />
        </div>
        <h3 className="k-text-lg k-font-semibold">Selecciona una Organización</h3>
        <p className="k-text-sm k-text-muted-foreground k-mt-1 k-max-w-md">
          Para ver y administrar las aplicaciones disponibles y sus permisos, selecciona una organización en el menú superior.
        </p>
      </Card>
    );
  }

  // GoTrue OAuth clients no application row points at yet — created before
  // migration 0036 introduced the link, or otherwise never linked.
  const linkedOauthClientIds = new Set(
    [...(enabled ?? []), ...(available ?? [])].map((app) => app.oauth_client_id).filter((id): id is string => id !== null),
  );
  const unlinkedOauthClients = [...oauthClients.values()].filter((client) => !linkedOauthClientIds.has(client.client_id));

  // Filter application lists
  const filterList = (list: ApplicationRow[] | null) => {
    if (!list) return null;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return list;
    return list.filter((app) => app.name.toLowerCase().includes(query) || app.slug.toLowerCase().includes(query));
  };

  const filteredEnabled = filterList(enabled);
  const filteredAvailable = filterList(available);

  const enabledCount = enabled?.length ?? 0;
  const availableCount = available?.length ?? 0;
  const totalCount = enabledCount + availableCount;

  return (
    <div className="k-flex k-flex-col k-gap-6 k-pb-12">
      {/* --- HERO BANNER --- */}
      <div className="k-relative k-overflow-hidden k-rounded-2xl k-bg-[linear-gradient(135deg,#1b1030,#2b1a52_45%,#4c2a8c)] k-p-6 sm:k-p-8 k-shadow-md k-text-white">
        <div className="k-relative k-z-10 k-flex k-flex-col md:k-flex-row md:k-items-center md:k-justify-between k-gap-4">
          <div>
            <span className="k-inline-flex k-items-center k-gap-2 k-rounded-full k-bg-white/10 k-px-3.5 k-py-1 k-text-xs k-font-semibold k-text-white/80 k-backdrop-blur-sm">
              <AppIcon className="k-w-3.5 k-h-3.5" />
              <span>Catálogo y Servicios SSO</span>
            </span>
            <h1 className="k-mt-3 k-text-3xl sm:k-text-4xl k-font-extrabold k-tracking-tight k-text-white">
              Aplicaciones
            </h1>
            <p className="k-mt-1.5 k-text-sm sm:k-text-base k-text-white/70 k-max-w-2xl">
              Gestión de aplicaciones habilitadas y permisos para{" "}
              <strong className="k-text-white k-font-semibold">{organization.name}</strong>.
            </p>
          </div>
        </div>
        <div className="k-absolute -k-right-10 -k-top-10 k-w-64 k-h-64 k-rounded-full k-bg-white/5 k-blur-2xl k-pointer-events-none" />
      </div>

      {/* --- INFO EXPLANATION BANNER --- */}
      {showInfoBanner && (
        <div className="k-relative k-rounded-xl k-border k-border-primary/20 k-bg-primary/5 k-p-4 k-text-sm k-flex k-items-start k-gap-3.5">
          <InfoIcon className="k-w-5 k-h-5 k-text-primary k-shrink-0 k-mt-0.5" />
          <div className="k-flex-1 k-pr-6">
            <p className="k-font-semibold k-text-foreground">Sincronización Automática de Permisos</p>
            <p className="k-text-xs k-text-muted-foreground k-mt-1 k-leading-relaxed">
              Cada aplicación mantiene su propio catálogo sincronizado automáticamente desde su pipeline de despliegue (CI/CD),
              usando su API Key. Solo las aplicaciones habilitadas aquí aparecen en la sección de Permisos para su asignación a
              roles. Si deseas habilitar SSO de Auth-Server, configura su cliente OAuth.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowInfoBanner(false)}
            className="k-absolute k-top-3.5 k-right-3.5 k-text-muted-foreground hover:k-text-foreground"
          >
            <XIcon className="k-w-4 k-h-4" />
          </button>
        </div>
      )}

      {/* --- ERROR NOTICE --- */}
      {error && (
        <div className="k-flex k-items-start k-gap-3 k-rounded-xl k-border k-border-destructive/30 k-bg-destructive/10 k-p-4 k-text-sm k-text-destructive">
          <AlertTriangleIcon className="k-w-5 k-h-5 k-shrink-0 k-mt-0.5" />
          <div className="k-flex-1">
            <p className="k-font-semibold">Error</p>
            <p className="k-mt-0.5">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="k-text-destructive hover:k-opacity-70">
            <XIcon />
          </button>
        </div>
      )}

      {/* --- METRICS STATS BAR --- */}
      <div className="k-grid k-grid-cols-1 sm:k-grid-cols-3 k-gap-4">
        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-primary/10 k-text-primary">
            <AppIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{enabled === null ? "—" : totalCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Catálogo Total</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-emerald-500/10 k-text-emerald-600 dark:k-text-emerald-400">
            <CheckCircleIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{enabled === null ? "—" : enabledCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Habilitadas en Org</p>
          </div>
        </Card>

        <Card className="k-p-4 k-flex k-items-center k-gap-4">
          <div className="k-flex k-h-12 k-w-12 k-items-center k-justify-center k-rounded-xl k-bg-amber-500/10 k-text-amber-600 dark:k-text-amber-400">
            <PlusCircleIcon className="k-w-6 k-h-6" />
          </div>
          <div>
            <p className="k-text-2xl k-font-bold">{available === null ? "—" : availableCount}</p>
            <p className="k-text-xs k-font-medium k-text-muted-foreground">Disponibles</p>
          </div>
        </Card>
      </div>

      {/* --- CONTROL TOOLBAR (Search & View toggles) --- */}
      <div className="k-flex k-flex-col sm:k-flex-row sm:k-items-center sm:k-justify-between k-gap-3 k-bg-card k-p-3 k-rounded-xl k-border k-border-border">
        {/* Search Input */}
        <div className="k-relative k-flex-1">
          <SearchIcon className="k-absolute k-left-3 k-top-1/2 -k-translate-y-1/2 k-text-muted-foreground k-w-4 k-h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar aplicación por nombre o slug..."
            className="k-w-full k-rounded-lg k-border k-border-border k-bg-background k-pl-9 k-pr-8 k-py-2 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary k-transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="k-absolute k-right-2.5 k-top-1/2 -k-translate-y-1/2 k-text-muted-foreground hover:k-text-foreground"
            >
              <XIcon className="k-w-3.5 k-h-3.5" />
            </button>
          )}
        </div>

        <div className="k-flex k-items-center k-gap-2">
          {/* Status Tabs */}
          <div className="k-inline-flex k-items-center k-rounded-lg k-bg-muted k-p-1 k-text-xs k-font-medium">
            <button
              type="button"
              onClick={() => setFilterRoleTab("enabled")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                filterTab === "enabled"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Habilitadas ({enabledCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterRoleTab("available")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                filterTab === "available"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Disponibles ({availableCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterRoleTab("all")}
              className={`k-px-3 k-py-1.5 k-rounded-md k-transition-all ${
                filterTab === "all"
                  ? "k-bg-background k-text-foreground k-shadow-sm k-font-semibold"
                  : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              Todas ({totalCount})
            </button>
          </div>

          {/* Grid/Table Switcher */}
          <div className="k-inline-flex k-items-center k-rounded-lg k-bg-muted k-p-1">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Vista de cuadrícula"
              className={`k-p-1.5 k-rounded-md k-transition-all ${
                viewMode === "grid" ? "k-bg-background k-text-foreground k-shadow-sm" : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              <LayoutGridIcon />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Vista de lista"
              className={`k-p-1.5 k-rounded-md k-transition-all ${
                viewMode === "table" ? "k-bg-background k-text-foreground k-shadow-sm" : "k-text-muted-foreground hover:k-text-foreground"
              }`}
            >
              <ListIcon />
            </button>
          </div>
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      {enabled === null ? (
        /* LOADING SKELETON */
        <div className="k-grid k-grid-cols-1 md:k-grid-cols-2 k-gap-5">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="k-p-5 k-flex k-flex-col k-gap-4 k-animate-pulse">
              <div className="k-flex k-items-center k-gap-3">
                <div className="k-w-10 k-h-10 k-rounded-xl k-bg-muted" />
                <div className="k-flex-1 k-flex k-flex-col k-gap-1.5">
                  <div className="k-h-4 k-w-1/2 k-bg-muted k-rounded" />
                  <div className="k-h-3 k-w-1/4 k-bg-muted k-rounded" />
                </div>
              </div>
              <div className="k-h-16 k-w-full k-bg-muted/60 k-rounded-md" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="k-flex k-flex-col k-gap-8">
          {/* SECTION: HABILITADAS */}
          {(filterTab === "enabled" || filterTab === "all") && (
            <div>
              <div className="k-flex k-items-center k-justify-between k-mb-3">
                <h2 className="k-text-base k-font-semibold k-flex k-items-center k-gap-2">
                  <CheckCircleIcon className="k-w-4 k-h-4 k-text-emerald-600" />
                  <span>Aplicaciones Habilitadas ({filteredEnabled?.length ?? 0})</span>
                </h2>
              </div>

              {!filteredEnabled || filteredEnabled.length === 0 ? (
                <Card className="k-p-8 k-text-center k-flex k-flex-col k-items-center k-justify-center">
                  <p className="k-text-sm k-text-muted-foreground">
                    {searchQuery ? "No se encontraron aplicaciones habilitadas con ese filtro." : "Sin aplicaciones habilitadas para esta organización."}
                  </p>
                </Card>
              ) : viewMode === "grid" ? (
                /* GRID VIEW - HABILITADAS */
                <div className="k-grid k-grid-cols-1 lg:k-grid-cols-2 k-gap-5">
                  {filteredEnabled.map((app) => (
                    <AppCardItem
                      key={app.id}
                      app={app}
                      organizationId={organization.id}
                      canManage={canManage}
                      platformAdmin={platformAdmin}
                      pendingId={pendingId}
                      editingUrlId={editingUrlId}
                      urlDraft={urlDraft}
                      setUrlDraft={setUrlDraft}
                      setEditingUrlId={setEditingUrlId}
                      handleSaveUrl={handleSaveUrl}
                      setConfirmAction={setConfirmAction}
                      openOauthDialog={openOauthDialog}
                      openApiKeysDialog={openApiKeysDialog}
                      isEnabled={true}
                      handleEnable={handleEnable}
                    />
                  ))}
                </div>
              ) : (
                /* TABLE VIEW - HABILITADAS */
                <AppTableView
                  apps={filteredEnabled}
                  organizationId={organization.id}
                  canManage={canManage}
                  platformAdmin={platformAdmin}
                  pendingId={pendingId}
                  editingUrlId={editingUrlId}
                  urlDraft={urlDraft}
                  setUrlDraft={setUrlDraft}
                  setEditingUrlId={setEditingUrlId}
                  handleSaveUrl={handleSaveUrl}
                  setConfirmAction={setConfirmAction}
                  openOauthDialog={openOauthDialog}
                  openApiKeysDialog={openApiKeysDialog}
                  isEnabled={true}
                  handleEnable={handleEnable}
                />
              )}
            </div>
          )}

          {/* SECTION: DISPONIBLES */}
          {(filterTab === "available" || filterTab === "all") && (
            <div>
              <div className="k-flex k-items-center k-justify-between k-mb-3">
                <h2 className="k-text-base k-font-semibold k-flex k-items-center k-gap-2">
                  <PlusCircleIcon className="k-w-4 k-h-4 k-text-amber-600" />
                  <span>Disponibles para Habilitar ({filteredAvailable?.length ?? 0})</span>
                </h2>
              </div>

              {!filteredAvailable || filteredAvailable.length === 0 ? (
                <Card className="k-p-8 k-text-center k-flex k-flex-col k-items-center k-justify-center">
                  <p className="k-text-sm k-text-muted-foreground">
                    {searchQuery ? "No se encontraron aplicaciones disponibles con ese filtro." : "No hay más aplicaciones disponibles en el catálogo."}
                  </p>
                </Card>
              ) : viewMode === "grid" ? (
                /* GRID VIEW - DISPONIBLES */
                <div className="k-grid k-grid-cols-1 lg:k-grid-cols-2 k-gap-5">
                  {filteredAvailable.map((app) => (
                    <AppCardItem
                      key={app.id}
                      app={app}
                      organizationId={organization.id}
                      canManage={canManage}
                      platformAdmin={platformAdmin}
                      pendingId={pendingId}
                      editingUrlId={editingUrlId}
                      urlDraft={urlDraft}
                      setUrlDraft={setUrlDraft}
                      setEditingUrlId={setEditingUrlId}
                      handleSaveUrl={handleSaveUrl}
                      setConfirmAction={setConfirmAction}
                      openOauthDialog={openOauthDialog}
                      openApiKeysDialog={openApiKeysDialog}
                      isEnabled={false}
                      handleEnable={handleEnable}
                    />
                  ))}
                </div>
              ) : (
                /* TABLE VIEW - DISPONIBLES */
                <AppTableView
                  apps={filteredAvailable}
                  organizationId={organization.id}
                  canManage={canManage}
                  platformAdmin={platformAdmin}
                  pendingId={pendingId}
                  editingUrlId={editingUrlId}
                  urlDraft={urlDraft}
                  setUrlDraft={setUrlDraft}
                  setEditingUrlId={setEditingUrlId}
                  handleSaveUrl={handleSaveUrl}
                  setConfirmAction={setConfirmAction}
                  openOauthDialog={openOauthDialog}
                  openApiKeysDialog={openApiKeysDialog}
                  isEnabled={false}
                  handleEnable={handleEnable}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* --- LOAD MORE --- */}
      {hasMore && (
        <div className="k-text-center k-pt-4">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void handleLoadMore()}
            className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-border k-border-border k-bg-background k-px-4 k-py-2 k-text-sm k-font-medium hover:k-bg-muted disabled:k-opacity-60 k-transition-all"
          >
            {loadingMore ? (
              <>
                <SpinnerIcon />
                <span>Cargando...</span>
              </>
            ) : (
              <span>Cargar más aplicaciones</span>
            )}
          </button>
        </div>
      )}

      {/* --- CONFIRM DIALOG --- */}
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        destructive={confirmAction?.kind === "disable" || confirmAction?.kind === "revoke-key"}
        title={confirmAction?.kind === "disable" ? "Deshabilitar aplicación" : confirmAction?.kind === "claim" ? "Reclamar propiedad" : "Revocar API Key"}
        description={
          !confirmAction
            ? ""
            : confirmAction.kind === "disable"
              ? `¿Deshabilitar "${confirmAction.app.name}" para ${organization.name}? Quien inicie sesión con esa app dejará de poder acceder.`
              : confirmAction.kind === "claim"
                ? `¿Reclamar "${confirmAction.app.name}" para ${organization.name}? Esta organización pasará a controlar su catálogo global de permisos — no se puede deshacer ni transferir después.`
                : `¿Revocar la clave "${confirmAction.key.name}"? Cualquier integración que la use dejará de poder llamar al API de inmediato — esto no afecta a las demás claves de esta aplicación.`
        }
        confirmLabel={confirmAction?.kind === "disable" ? "Deshabilitar" : confirmAction?.kind === "claim" ? "Reclamar" : "Revocar"}
        onConfirm={async () => {
          if (!confirmAction) return;
          if (confirmAction.kind === "disable") await handleDisable(confirmAction.app.id);
          else if (confirmAction.kind === "claim") await handleClaim(confirmAction.app);
          else await handleRevokeKey(confirmAction.app, confirmAction.key);
        }}
      />

      {/* --- API KEYS DIALOG --- */}
      <Dialog
        open={apiKeysDialogApp !== null}
        onOpenChange={(open) => !open && setApiKeysDialogApp(null)}
        title="API Keys"
        description={
          apiKeysDialogApp
            ? `Cada clave permite que un backend llame al API de KontrolIA Auth a nombre de ${organization.name} — sincronizar el catálogo de permisos de "${apiKeysDialogApp.name}" (global) y gestionar los miembros de tu organización (con esta clave específica). No es lo mismo que el cliente OAuth (eso es para que los usuarios inicien sesión).`
            : undefined
        }
      >
        {apiKeysDialogApp && (
          <div className="k-flex k-flex-col k-gap-4 k-pt-1">
            {apiKeysError && <p className="k-rounded-lg k-bg-destructive/10 k-p-2.5 k-text-xs k-text-destructive">{apiKeysError}</p>}

            {newPlaintextKey && (
              <div className="k-flex k-flex-col k-gap-2 k-rounded-lg k-border k-border-emerald-500/40 k-bg-emerald-500/10 k-p-3.5">
                <div className="k-flex k-items-center k-gap-2 k-text-emerald-700 dark:k-text-emerald-300 k-font-semibold k-text-sm">
                  <KeyIcon className="k-w-4 k-h-4" />
                  <span>Nueva API Key generada</span>
                </div>
                <p className="k-text-xs k-text-muted-foreground">
                  Cópiala ahora. Por seguridad no se guarda en texto plano y no podrá mostrarse nuevamente.
                </p>
                <div className="k-rounded-lg k-bg-background/80 k-border k-border-emerald-500/30 k-px-3 k-py-2 k-font-mono k-text-xs k-text-foreground k-truncate select-all">
                  {newPlaintextKey}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(newPlaintextKey);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="k-inline-flex k-w-fit k-items-center k-gap-2 k-rounded-lg k-bg-emerald-600 k-px-3.5 k-py-1.5 k-text-sm k-font-medium k-text-white hover:k-bg-emerald-700 k-transition-all"
                >
                  {copied ? (
                    <>
                      <CheckIcon />
                      <span>¡Copiada!</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon />
                      <span>Copiar API Key</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {apiKeys === null ? (
              <p className="k-text-sm k-text-muted-foreground">Cargando claves...</p>
            ) : apiKeys.length === 0 ? (
              <p className="k-text-sm k-text-muted-foreground">Todavía no hay ninguna clave para esta aplicación.</p>
            ) : (
              <div className="k-flex k-flex-col k-gap-2">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="k-flex k-items-center k-justify-between k-gap-3 k-rounded-lg k-border k-border-border k-bg-muted/30 k-p-3 k-text-xs"
                  >
                    <div className="k-flex k-min-w-0 k-flex-col k-gap-0.5">
                      <span className="k-truncate k-font-semibold k-text-foreground">{key.name}</span>
                      <span className="k-font-mono k-text-muted-foreground">{key.keyPrefix ? `${key.keyPrefix}…` : "(clave original)"}</span>
                      <span className="k-text-muted-foreground">
                        {key.lastUsedAt ? `Último uso: ${new Date(key.lastUsedAt).toLocaleString()}` : "Nunca usada"}
                        {key.expiresAt && ` · Expira: ${new Date(key.expiresAt).toLocaleDateString()}`}
                      </span>
                    </div>
                    {key.revokedAt ? (
                      <Badge variant="neutral">Revocada</Badge>
                    ) : key.expiresAt && new Date(key.expiresAt) < new Date() ? (
                      <Badge variant="warning">Expirada</Badge>
                    ) : (
                      canManage && (
                        <button
                          type="button"
                          disabled={revokingKeyId === key.id}
                          onClick={() => setConfirmAction({ kind: "revoke-key", app: apiKeysDialogApp, key })}
                          className="k-shrink-0 k-rounded-md k-px-2.5 k-py-1 k-font-medium k-text-destructive hover:k-bg-destructive/10 disabled:k-opacity-60"
                        >
                          Revocar
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}

            {canManage && (
              <div className="k-flex k-flex-col k-gap-2 k-border-t k-border-border k-pt-3">
                <p className="k-text-xs k-font-semibold k-text-foreground">Nueva clave para {organization.name}</p>
                <div className="k-flex k-gap-2">
                  <input
                    type="text"
                    placeholder="Nombre, ej. Integración Zapier"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="k-flex-1 k-rounded-md k-border k-border-border k-bg-background k-px-2.5 k-py-1.5 k-text-xs"
                  />
                  <input
                    type="date"
                    value={newKeyExpiresAt}
                    onChange={(e) => setNewKeyExpiresAt(e.target.value)}
                    title="Fecha de expiración (opcional)"
                    className="k-rounded-md k-border k-border-border k-bg-background k-px-2.5 k-py-1.5 k-text-xs"
                  />
                </div>
                <button
                  type="button"
                  disabled={creatingKey || !newKeyName.trim()}
                  onClick={() => void handleCreateKey(apiKeysDialogApp)}
                  className="k-inline-flex k-w-fit k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-3.5 k-py-1.5 k-text-xs k-font-medium k-text-primary-foreground disabled:k-opacity-60 hover:k-opacity-90 k-transition-all"
                >
                  <KeyIcon className="k-w-3.5 k-h-3.5" />
                  <span>{creatingKey ? "Generando..." : "Generar clave"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* --- OAUTH CLIENT DIALOG --- */}
      <Dialog
        open={oauthDialogApp !== null}
        onOpenChange={(open) => !open && setOauthDialogApp(null)}
        title={oauthDialogApp?.oauth_client_id ? "Editar cliente OAuth" : "Crear cliente OAuth"}
        description={
          oauthDialogApp
            ? `Permite que "${oauthDialogApp.name}" use el login centralizado de auth-server (SSO).`
            : undefined
        }
      >
        <div className="k-flex k-flex-col k-gap-4 k-pt-1">
          {!oauthDialogApp?.oauth_client_id && unlinkedOauthClients.length > 0 && (
            <div className="k-flex k-flex-col k-gap-2 k-rounded-lg k-border k-border-primary/20 k-bg-primary/5 k-p-3.5">
              <p className="k-text-sm k-font-medium">¿Ya tienes un cliente OAuth para esta app?</p>
              <p className="k-text-xs k-text-muted-foreground">
                Encontramos {unlinkedOauthClients.length === 1 ? "un cliente" : "clientes"} sin vincular a ninguna
                aplicación — probablemente creado antes de que esta pantalla existiera. Vincúlalo en vez de crear uno nuevo.
              </p>
              <select
                value={oauthLinkClientId}
                onChange={(e) => setOauthLinkClientId(e.target.value)}
                className="k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary"
              >
                <option value="">Selecciona un cliente existente…</option>
                {unlinkedOauthClients.map((client) => (
                  <option key={client.client_id} value={client.client_id}>
                    {client.client_name} — {client.redirect_uris.join(", ")}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleLinkExistingOauthClient()}
                disabled={oauthLinking || !oauthLinkClientId}
                className="k-inline-flex k-w-fit k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-3.5 k-py-1.5 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60 hover:k-opacity-90 k-transition-all"
              >
                {oauthLinking ? (
                  <>
                    <SpinnerIcon />
                    <span>Vinculando...</span>
                  </>
                ) : (
                  <span>Vincular cliente existente</span>
                )}
              </button>
              <p className="k-text-xs k-text-muted-foreground k-pt-1 k-border-t k-border-border/60">
                O crea uno nuevo abajo:
              </p>
            </div>
          )}

          <div className="k-flex k-flex-col k-gap-1.5">
            <label htmlFor="k-oauth-app-name" className="k-text-sm k-font-medium">
              Nombre de la aplicación
            </label>
            <input
              id="k-oauth-app-name"
              type="text"
              required
              value={oauthName}
              onChange={(e) => setOauthName(e.target.value)}
              className="k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2.5 k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary"
            />
          </div>

          <div className="k-flex k-flex-col k-gap-1.5">
            <label htmlFor="k-oauth-app-redirects" className="k-text-sm k-font-medium">
              Redirect URIs (una por línea)
            </label>
            <textarea
              id="k-oauth-app-redirects"
              required
              rows={3}
              value={oauthRedirectUris}
              onChange={(e) => setOauthRedirectUris(e.target.value)}
              placeholder="https://facturacion.tuempresa.com/oauth/callback"
              className="k-rounded-lg k-border k-border-border k-bg-background k-px-3.5 k-py-2.5 k-font-mono k-text-sm focus:k-outline-none focus:k-ring-2 focus:k-ring-primary/20 focus:k-border-primary"
            />
            <p className="k-text-xs k-text-muted-foreground">
              Direcciones URIs autorizadas para recibir tokens de autenticación OAuth 2.1 tras iniciar sesión.
            </p>
          </div>

          {oauthError && (
            <p className="k-text-sm k-text-destructive k-bg-destructive/10 k-border k-border-destructive/20 k-p-3 k-rounded-lg">
              {oauthError}
            </p>
          )}

          <div className="k-flex k-justify-end k-gap-3 k-pt-2">
            <button
              type="button"
              onClick={() => setOauthDialogApp(null)}
              disabled={oauthSaving}
              className="k-rounded-lg k-px-4 k-py-2 k-text-sm k-font-medium k-text-muted-foreground hover:k-bg-muted disabled:k-opacity-60 k-transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSaveOauthClient()}
              disabled={oauthSaving || !oauthName.trim() || !oauthRedirectUris.trim()}
              className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60 hover:k-opacity-90 k-transition-all"
            >
              {oauthSaving ? (
                <>
                  <SpinnerIcon />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Guardar Cliente</span>
              )}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

{/* --- SUB-COMPONENT: SINGLE APP CARD ITEM --- */}
function AppCardItem({
  app,
  organizationId,
  canManage,
  platformAdmin,
  pendingId,
  editingUrlId,
  urlDraft,
  setUrlDraft,
  setEditingUrlId,
  handleSaveUrl,
  setConfirmAction,
  openOauthDialog,
  openApiKeysDialog,
  isEnabled,
  handleEnable,
}: {
  app: ApplicationRow;
  organizationId: string;
  canManage: boolean;
  platformAdmin: boolean;
  pendingId: string | null;
  editingUrlId: string | null;
  urlDraft: string;
  setUrlDraft: (v: string) => void;
  setEditingUrlId: (id: string | null) => void;
  handleSaveUrl: (id: string) => void;
  setConfirmAction: (action: ConfirmAction | null) => void;
  openOauthDialog: (app: ApplicationRow) => void;
  openApiKeysDialog: (app: ApplicationRow) => void;
  isEnabled: boolean;
  handleEnable: (id: string) => void;
}) {
  const isOwnerOrg = app.owner_organization_id === organizationId;
  const isUnowned = app.owner_organization_id === null;

  return (
    <Card className="k-p-5 k-flex k-flex-col k-justify-between k-gap-4 hover:k-border-primary/40 hover:k-shadow-md k-transition-all k-duration-200">
      {/* Top Header */}
      <div className="k-flex k-items-start k-justify-between k-gap-3">
        <div className="k-flex k-items-center k-gap-3 k-min-w-0">
          <div
            className={`k-w-11 k-h-11 k-rounded-xl k-flex k-items-center k-justify-center k-font-bold k-text-sm k-shrink-0 k-shadow-sm ${getAvatarGradient(
              app.id
            )}`}
          >
            {getInitials(app.name)}
          </div>
          <div className="k-min-w-0">
            <h3 className="k-font-semibold k-text-base k-truncate" title={app.name}>
              {app.name}
            </h3>
            <div className="k-flex k-items-center k-gap-2 k-mt-0.5">
              <code className="k-text-xs k-font-mono k-text-muted-foreground">{app.slug}</code>
              <Badge variant={app.environment === "production" ? "success" : "neutral"}>
                {app.environment}
              </Badge>
            </div>
          </div>
        </div>

        {/* Permissions Count Badge */}
        <div className="k-shrink-0">
          <span className="k-inline-flex k-items-center k-gap-1 k-rounded-md k-bg-muted k-px-2.5 k-py-1 k-text-xs k-font-semibold k-text-muted-foreground">
            <ShieldCheckIcon />
            <span>{app.permissionCount} permisos</span>
          </span>
        </div>
      </div>

      {/* Details Section */}
      <div className="k-flex k-flex-col k-gap-2.5 k-rounded-xl k-bg-muted/40 k-p-3.5 k-text-xs">
        {/* Homepage URL */}
        <div className="k-flex k-items-center k-justify-between k-gap-2">
          <span className="k-text-muted-foreground k-font-medium">URL de acceso:</span>
          {editingUrlId === app.id ? (
            <div className="k-flex k-items-center k-gap-1.5">
              <input
                type="url"
                autoFocus
                placeholder="https://..."
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                className="k-w-40 k-rounded k-border k-border-border k-bg-background k-px-2 k-py-0.5 k-text-xs"
              />
              <button
                type="button"
                disabled={pendingId === app.id}
                onClick={() => void handleSaveUrl(app.id)}
                className="k-font-medium k-text-primary hover:k-underline"
              >
                Guardar
              </button>
              <button type="button" onClick={() => setEditingUrlId(null)} className="k-text-muted-foreground">
                <XIcon className="k-w-3.5 k-h-3.5" />
              </button>
            </div>
          ) : app.homepage_url ? (
            <div className="k-flex k-items-center k-gap-1.5 k-min-w-0">
              <a
                href={app.homepage_url}
                target="_blank"
                rel="noreferrer"
                className="k-text-primary hover:k-underline k-truncate k-font-mono"
              >
                {app.homepage_url}
              </a>
              <ExternalLinkIcon className="k-w-3.5 k-h-3.5 k-text-primary k-shrink-0" />
              {isOwnerOrg && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingUrlId(app.id);
                    setUrlDraft(app.homepage_url ?? "");
                  }}
                  className="k-text-muted-foreground hover:k-text-foreground k-ml-1"
                >
                  <EditIcon />
                </button>
              )}
            </div>
          ) : isOwnerOrg ? (
            <button
              type="button"
              onClick={() => {
                setEditingUrlId(app.id);
                setUrlDraft("");
              }}
              className="k-text-primary hover:k-underline k-font-medium"
            >
              + Configurar URL
            </button>
          ) : (
            <span className="k-text-muted-foreground">—</span>
          )}
        </div>

        {/* API Keys / Ownership status */}
        <div className="k-flex k-items-center k-justify-between k-gap-2 k-border-t k-border-border/50 k-pt-2">
          <span className="k-text-muted-foreground k-font-medium">API Keys:</span>
          {isEnabled ? (
            <button
              type="button"
              onClick={() => openApiKeysDialog(app)}
              className="k-inline-flex k-items-center k-gap-1.5 k-text-primary hover:k-underline k-font-medium"
            >
              <KeyIcon className="k-w-3.5 k-h-3.5" />
              Gestionar
            </button>
          ) : isUnowned && platformAdmin ? (
            <button
              type="button"
              disabled={pendingId === app.id}
              onClick={() => setConfirmAction({ kind: "claim", app })}
              className="k-text-primary k-font-semibold hover:k-underline"
            >
              Reclamar propiedad
            </button>
          ) : isUnowned ? (
            <span className="k-text-muted-foreground">Sin propietario</span>
          ) : (
            <span className="k-text-muted-foreground">No habilitada</span>
          )}
        </div>

        {/* OAuth Client Status (Platform Admins) */}
        {platformAdmin && isOwnerOrg && (
          <div className="k-flex k-items-center k-justify-between k-gap-2 k-border-t k-border-border/50 k-pt-2">
            <span className="k-text-muted-foreground k-font-medium">Cliente OAuth (SSO):</span>
            {app.oauth_client_id ? (
              <div className="k-flex k-items-center k-gap-2">
                <Badge variant="success">Conectado</Badge>
                <button
                  type="button"
                  onClick={() => openOauthDialog(app)}
                  className="k-text-primary hover:k-underline k-font-medium"
                >
                  Editar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openOauthDialog(app)}
                className="k-text-primary hover:k-underline k-font-semibold"
              >
                + Crear Cliente OAuth
              </button>
            )}
          </div>
        )}
      </div>

      {/* Card Footer Actions */}
      <div className="k-flex k-items-center k-justify-between k-pt-2 k-border-t k-border-border/60">
        <div>
          {isEnabled ? (
            <span className="k-inline-flex k-items-center k-gap-1.5 k-text-xs k-font-medium k-text-emerald-600 dark:k-text-emerald-400">
              <CheckIcon /> Habilitada para {app.owner_organization_id === organizationId ? "tu org" : "esta org"}
            </span>
          ) : (
            <span className="k-inline-flex k-items-center k-gap-1.5 k-text-xs k-text-muted-foreground">
              <LockIcon /> No habilitada
            </span>
          )}
        </div>

        {canManage && (
          <div>
            {isEnabled ? (
              <button
                type="button"
                disabled={pendingId === app.id}
                onClick={() => setConfirmAction({ kind: "disable", app })}
                className="k-inline-flex k-items-center k-gap-1 k-px-3 k-py-1.5 k-rounded-lg k-text-xs k-font-medium k-text-destructive hover:k-bg-destructive/10 k-transition-all disabled:k-opacity-50"
              >
                {pendingId === app.id ? <SpinnerIcon /> : null}
                <span>Deshabilitar</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={pendingId === app.id}
                onClick={() => void handleEnable(app.id)}
                className="k-inline-flex k-items-center k-gap-1.5 k-px-3.5 k-py-1.5 k-rounded-lg k-bg-primary k-text-xs k-font-medium k-text-primary-foreground hover:k-opacity-90 k-transition-all disabled:k-opacity-50"
              >
                {pendingId === app.id ? <SpinnerIcon /> : <PlusCircleIcon className="k-w-3.5 k-h-3.5" />}
                <span>Habilitar</span>
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

{/* --- SUB-COMPONENT: TABLE VIEW FOR APPS --- */}
function AppTableView({
  apps,
  organizationId,
  canManage,
  platformAdmin,
  pendingId,
  editingUrlId,
  urlDraft,
  setUrlDraft,
  handleSaveUrl,
  setConfirmAction,
  openOauthDialog,
  openApiKeysDialog,
  isEnabled,
  handleEnable,
}: {
  apps: ApplicationRow[];
  organizationId: string;
  canManage: boolean;
  platformAdmin: boolean;
  pendingId: string | null;
  editingUrlId: string | null;
  urlDraft: string;
  setUrlDraft: (v: string) => void;
  setEditingUrlId?: (id: string | null) => void;
  handleSaveUrl: (id: string) => void;
  setConfirmAction: (action: ConfirmAction | null) => void;
  openOauthDialog: (app: ApplicationRow) => void;
  openApiKeysDialog: (app: ApplicationRow) => void;
  isEnabled: boolean;
  handleEnable: (id: string) => void;
}) {
  return (
    <Card className="k-p-0 k-overflow-hidden">
      <div className="k-overflow-x-auto">
        <table className="k-w-full k-text-sm">
          <thead>
            <tr className="k-border-b k-border-border k-bg-muted/40 k-text-left k-text-xs k-uppercase k-tracking-wider k-text-muted-foreground">
              <th className="k-px-5 k-py-3.5 k-font-semibold">Aplicación</th>
              <th className="k-px-5 k-py-3.5 k-font-semibold">Slug</th>
              <th className="k-px-5 k-py-3.5 k-font-semibold">Entorno</th>
              <th className="k-px-5 k-py-3.5 k-font-semibold">Permisos</th>
              <th className="k-px-5 k-py-3.5 k-font-semibold">URL</th>
              <th className="k-px-5 k-py-3.5 k-font-semibold">API Key</th>
              {platformAdmin && <th className="k-px-5 k-py-3.5 k-font-semibold">OAuth SSO</th>}
              <th className="k-px-5 k-py-3.5 k-font-semibold k-text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="k-divide-y k-divide-border">
            {apps.map((app) => {
              const isOwnerOrg = app.owner_organization_id === organizationId;
              return (
                <tr key={app.id} className="hover:k-bg-muted/30 k-transition-colors">
                  {/* Name & Avatar */}
                  <td className="k-px-5 k-py-3.5">
                    <div className="k-flex k-items-center k-gap-3">
                      <div
                        className={`k-w-8 k-h-8 k-rounded-lg k-flex k-items-center k-justify-center k-font-bold k-text-xs k-shrink-0 ${getAvatarGradient(
                          app.id
                        )}`}
                      >
                        {getInitials(app.name)}
                      </div>
                      <span className="k-font-semibold k-text-foreground">{app.name}</span>
                    </div>
                  </td>

                  {/* Slug */}
                  <td className="k-px-5 k-py-3.5 k-text-xs k-font-mono k-text-muted-foreground">{app.slug}</td>

                  {/* Environment */}
                  <td className="k-px-5 k-py-3.5">
                    <Badge variant={app.environment === "production" ? "success" : "neutral"}>{app.environment}</Badge>
                  </td>

                  {/* Permissions count */}
                  <td className="k-px-5 k-py-3.5 k-text-xs k-font-medium">{app.permissionCount} permisos</td>

                  {/* URL */}
                  <td className="k-px-5 k-py-3.5 k-text-xs">
                    {editingUrlId === app.id ? (
                      <div className="k-flex k-items-center k-gap-1.5">
                        <input
                          type="url"
                          autoFocus
                          placeholder="https://..."
                          value={urlDraft}
                          onChange={(e) => setUrlDraft(e.target.value)}
                          className="k-w-36 k-rounded k-border k-border-border k-bg-background k-px-2 k-py-0.5 k-text-xs"
                        />
                        <button
                          type="button"
                          disabled={pendingId === app.id}
                          onClick={() => void handleSaveUrl(app.id)}
                          className="k-font-medium k-text-primary hover:k-underline"
                        >
                          Guardar
                        </button>
                      </div>
                    ) : app.homepage_url ? (
                      <a href={app.homepage_url} target="_blank" rel="noreferrer" className="k-text-primary hover:k-underline k-font-mono">
                        {app.homepage_url}
                      </a>
                    ) : (
                      <span className="k-text-muted-foreground">—</span>
                    )}
                  </td>

                  {/* API Keys / ownership */}
                  <td className="k-px-5 k-py-3.5 k-text-xs">
                    {isEnabled ? (
                      <button
                        type="button"
                        onClick={() => openApiKeysDialog(app)}
                        className="k-text-primary hover:k-underline k-font-medium"
                      >
                        Gestionar
                      </button>
                    ) : app.owner_organization_id === null && platformAdmin ? (
                      <button
                        type="button"
                        disabled={pendingId === app.id}
                        onClick={() => setConfirmAction({ kind: "claim", app })}
                        className="k-text-primary k-font-semibold hover:k-underline"
                      >
                        Reclamar propiedad
                      </button>
                    ) : app.owner_organization_id === null ? (
                      <span className="k-text-muted-foreground">Sin propietario</span>
                    ) : (
                      <span className="k-text-muted-foreground">No habilitada</span>
                    )}
                  </td>

                  {/* OAuth */}
                  {platformAdmin && (
                    <td className="k-px-5 k-py-3.5 k-text-xs">
                      {isOwnerOrg ? (
                        app.oauth_client_id ? (
                          <button type="button" onClick={() => openOauthDialog(app)} className="k-font-medium k-text-primary hover:k-underline">
                            Editar
                          </button>
                        ) : (
                          <button type="button" onClick={() => openOauthDialog(app)} className="k-text-primary hover:k-underline">
                            + Crear
                          </button>
                        )
                      ) : (
                        <span className="k-text-muted-foreground">—</span>
                      )}
                    </td>
                  )}

                  {/* Action */}
                  <td className="k-px-5 k-py-3.5 k-text-right">
                    {canManage && (
                      isEnabled ? (
                        <button
                          type="button"
                          disabled={pendingId === app.id}
                          onClick={() => setConfirmAction({ kind: "disable", app })}
                          className="k-text-xs k-font-medium k-text-destructive hover:k-underline disabled:k-opacity-50"
                        >
                          Deshabilitar
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pendingId === app.id}
                          onClick={() => void handleEnable(app.id)}
                          className="k-text-xs k-font-medium k-text-primary hover:k-underline disabled:k-opacity-50"
                        >
                          Habilitar
                        </button>
                      )
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

