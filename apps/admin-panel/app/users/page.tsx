"use client";

import { useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import { useEffect, useState } from "react";
import { createKontroliaSchemaClient } from "@/lib/supabase-browser";

interface MembershipRow {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
}

export default function UsersPage() {
  const { organization } = useAuth();
  const [memberships, setMemberships] = useState<MembershipRow[] | null>(null);

  useEffect(() => {
    if (!organization) return;
    const supabase = createKontroliaSchemaClient();
    supabase
      .from("memberships")
      .select("id, user_id, status, created_at")
      .eq("organization_id", organization.id)
      .then(({ data }) => setMemberships(data));
  }, [organization]);

  return (
    <div className="k-flex k-flex-col k-gap-5">
      <div>
        <h1 className="k-text-2xl k-font-bold">Usuarios</h1>
        <p className="k-text-sm k-text-muted-foreground">Miembros de {organization?.name ?? "la organización"}.</p>
      </div>
      <Card className="k-p-0">
        <table className="k-w-full k-text-sm">
          <thead>
            <tr className="k-border-b k-border-border k-text-left k-text-xs k-uppercase k-tracking-wide k-text-muted-foreground">
              <th className="k-px-5 k-py-3 k-font-semibold">Usuario</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Estado</th>
              <th className="k-px-5 k-py-3 k-font-semibold">Desde</th>
            </tr>
          </thead>
          <tbody>
            {memberships?.map((m) => (
              <tr key={m.id} className="k-border-b k-border-border last:k-border-0">
                <td className="k-px-5 k-py-3 k-font-mono k-text-xs">{m.user_id}</td>
                <td className="k-px-5 k-py-3">
                  <Badge variant={m.status === "active" ? "success" : "neutral"}>{m.status}</Badge>
                </td>
                <td className="k-px-5 k-py-3 k-text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {memberships?.length === 0 && <p className="k-px-5 k-py-6 k-text-sm k-text-muted-foreground">Sin usuarios todavía.</p>}
      </Card>
    </div>
  );
}
