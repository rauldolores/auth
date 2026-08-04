"use client";

import { useAuth } from "@kontrolia/react";
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
  "invitation.created": "Invitación enviada",
  "invitation.accepted": "Invitación aceptada",
  "role.assigned": "Rol asignado",
  "role.unassigned": "Rol removido",
  "device.revoked": "Sesión revocada",
};

export default function AuditLogsPage() {
  const { organization } = useAuth();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);

  useEffect(() => {
    if (!organization) return;
    const supabase = createKontroliaSchemaClient();
    supabase
      .from("audit_logs")
      .select("id, actor_user_id, action, target_type, target_id, metadata, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<AuditLogRow[]>()
      .then(({ data }) => setLogs(data ?? []));
  }, [organization?.id]);

  if (!organization) {
    return <p className="k-text-sm k-text-muted-foreground">Selecciona una organización primero.</p>;
  }

  return (
    <div className="k-flex k-flex-col k-gap-6">
      <h1 className="k-text-xl k-font-semibold">Audit log — {organization.name}</h1>
      <table className="k-w-full k-text-sm">
        <thead>
          <tr className="k-border-b k-border-border k-text-left k-text-muted-foreground">
            <th className="k-py-2">Acción</th>
            <th className="k-py-2">Detalle</th>
            <th className="k-py-2">Actor</th>
            <th className="k-py-2">Fecha</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="k-border-b k-border-border">
              <td className="k-py-2">{ACTION_LABELS[log.action] ?? log.action}</td>
              <td className="k-py-2 k-font-mono k-text-xs k-text-muted-foreground">
                {Object.entries(log.metadata)
                  .map(([key, value]) => `${key}=${String(value)}`)
                  .join(" ")}
              </td>
              <td className="k-py-2 k-font-mono k-text-xs k-text-muted-foreground">
                {log.actor_user_id ?? "sistema"}
              </td>
              <td className="k-py-2 k-text-muted-foreground">{new Date(log.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p className="k-text-sm k-text-muted-foreground">Sin actividad registrada todavía.</p>}
    </div>
  );
}
