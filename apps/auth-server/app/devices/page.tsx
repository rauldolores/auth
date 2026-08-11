"use client";

import { AuthGuard } from "@kontrolia/react";
import { Card } from "@kontrolia/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DeviceRow {
  session_id: string;
  label: string;
  ip: string | null;
  last_seen_at: string;
  created_at: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/devices");
    const body = (await res.json()) as { devices?: DeviceRow[]; currentSessionId?: string; error?: string };
    if (!res.ok) {
      setError(body.error ?? "No se pudieron cargar los dispositivos.");
      return;
    }
    setDevices(body.devices ?? []);
    setCurrentSessionId(body.currentSessionId ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function revoke(sessionId: string, label: string) {
    if (!window.confirm(`¿Cerrar la sesión de "${label}"? Esa sesión perderá el acceso de inmediato.`)) return;
    setRevokingId(sessionId);
    setError(null);
    try {
      const res = await fetch("/api/devices/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "No se pudo cerrar esa sesión.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar esa sesión.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <AuthGuard fallback={<p className="k-p-8 k-text-sm">Inicia sesión para ver tus dispositivos.</p>}>
      <div className="k-mx-auto k-flex k-max-w-2xl k-flex-col k-gap-6 k-p-8">
        <div className="k-flex k-items-center k-justify-between">
          <h1 className="k-text-2xl k-font-bold">Dispositivos y sesiones</h1>
          <Link href="/" className="k-text-sm k-text-muted-foreground hover:k-underline">
            Volver
          </Link>
        </div>
        {error && <p className="k-text-sm k-text-destructive">{error}</p>}
        <Card className="k-flex k-flex-col k-gap-2 k-p-3">
          {devices.map((device) => {
            const isCurrent = device.session_id === currentSessionId;
            return (
              <div
                key={device.session_id}
                className="k-flex k-items-center k-justify-between k-rounded-lg k-border k-border-border k-p-3 k-text-sm"
              >
                <div>
                  <p className="k-font-medium">
                    {device.label} {isCurrent && <span className="k-text-muted-foreground">(este dispositivo)</span>}
                  </p>
                  <p className="k-text-muted-foreground">
                    {device.ip ?? "IP desconocida"} · última actividad {new Date(device.last_seen_at).toLocaleString()}
                  </p>
                </div>
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => void revoke(device.session_id, device.label)}
                    disabled={revokingId === device.session_id}
                    className="k-rounded-md k-border k-border-border k-px-3 k-py-1.5 k-text-sm hover:k-bg-muted disabled:k-opacity-60"
                  >
                    {revokingId === device.session_id ? "Cerrando..." : "Cerrar sesión"}
                  </button>
                )}
              </div>
            );
          })}
          {devices.length === 0 && <p className="k-p-3 k-text-sm k-text-muted-foreground">Sin dispositivos registrados todavía.</p>}
        </Card>
      </div>
    </AuthGuard>
  );
}
