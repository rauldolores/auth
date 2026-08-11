"use client";

import { useAuth } from "@kontrolia/react";
import { Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface AuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  "organization.created": "Organización creada",
  "membership.created": "Miembro agregado",
  "membership.removed": "Miembro eliminado",
  "membership.status_changed": "Estado de miembro cambiado",
  "invitation.created": "Invitación enviada",
  "invitation.accepted": "Invitación aceptada",
  "invitation.revoked": "Invitación revocada",
  "invitation.resent": "Invitación reenviada",
  "role.assigned": "Rol asignado",
  "role.unassigned": "Rol removido",
  "device.revoked": "Sesión revocada",
};

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const { organization } = useAuth();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadPage(offset: number) {
    if (!organization) return;
    const supabase = createKontroliaSchemaClient();
    const { data, error: fetchError } = await supabase
      .from("audit_logs")
      .select("id, actor_user_id, action, target_type, target_id, metadata, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)
      .returns<AuditLogRow[]>();

    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setError(null);
    const page = data ?? [];
    setLogs((current) => (offset === 0 ? page : [...current, ...page]));
    setHasMore(page.length === PAGE_SIZE);
  }

  useEffect(() => {
    setLogs([]);
    void loadPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]);

  async function handleLoadMore() {
    setLoadingMore(true);
    await loadPage(logs.length);
    setLoadingMore(false);
  }

  if (!organization) {
    return <p className="k-text-sm k-text-muted-foreground">Selecciona una organización primero.</p>;
  }

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Audit log</h1>
        <p className="k-text-sm k-text-muted-foreground">Actividad reciente en {organization.name}.</p>
      </div>
      {error && <p className="k-text-sm k-text-destructive">No se pudo cargar el audit log: {error}</p>}
      <Card className="k-p-0">
        <div className="k-overflow-x-auto">
        <table className="k-w-full k-text-sm">
          <thead>
            <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
              <th className="k-px-5 k-py-3 k-font-semibold">Acción</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Detalle</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Actor</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="k-border-b k-border-border last:k-border-0">
                <td className="k-px-5 k-py-3 k-font-medium">{ACTION_LABELS[log.action] ?? log.action}</td>
                <td className="k-px-5 k-py-3 k-font-mono k-text-xs k-text-muted-foreground">
                  {Object.entries(log.metadata)
                    .map(([key, value]) => `${key}=${String(value)}`)
                    .join(" ")}
                </td>
                <td className="k-px-5 k-py-3 k-font-mono k-text-xs k-text-muted-foreground">{log.actor_user_id ?? "sistema"}</td>
                <td className="k-px-5 k-py-3 k-text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {logs.length === 0 && !error && (
          <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin actividad registrada todavía.</p>
        )}
        {hasMore && (
          <div className="k-border-t k-border-border k-p-3 k-text-center">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void handleLoadMore()}
              className="k-text-sm k-text-muted-foreground hover:k-underline disabled:k-opacity-60"
            >
              {loadingMore ? "Cargando..." : "Cargar más"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
