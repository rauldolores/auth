"use client";

import { useAuth } from "@kontrolia/react";
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
    <div className="k-flex k-flex-col k-gap-4">
      <h1 className="k-text-xl k-font-semibold">Usuarios de {organization?.name ?? "la organización"}</h1>
      <table className="k-w-full k-text-sm">
        <thead>
          <tr className="k-border-b k-border-border k-text-left k-text-muted-foreground">
            <th className="k-py-2">Usuario</th>
            <th className="k-py-2">Estado</th>
            <th className="k-py-2">Desde</th>
          </tr>
        </thead>
        <tbody>
          {memberships?.map((m) => (
            <tr key={m.id} className="k-border-b k-border-border">
              <td className="k-py-2 k-font-mono k-text-xs">{m.user_id}</td>
              <td className="k-py-2 k-text-muted-foreground">{m.status}</td>
              <td className="k-py-2 k-text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
