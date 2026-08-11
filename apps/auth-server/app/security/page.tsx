"use client";

import { AuthGuard, useAuth } from "@kontrolia/react";
import { Badge, Card } from "@kontrolia/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

interface FactorRow {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
}

export default function SecurityPage() {
  const { listMfaFactors, enrollMfa, verifyMfaEnrollment, unenrollMfa } = useAuth();

  const [factors, setFactors] = useState<FactorRow[]>([]);
  const [enrollment, setEnrollment] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadFactors() {
    const result = await listMfaFactors();
    setFactors(result);
  }

  useEffect(() => {
    void loadFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnrollment() {
    setError(null);
    try {
      const result = await enrollMfa();
      setEnrollment(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el registro de MFA.");
    }
  }

  async function confirmEnrollment(event: React.FormEvent) {
    event.preventDefault();
    if (!enrollment) return;
    setBusy(true);
    setError(null);
    try {
      await verifyMfaEnrollment(enrollment.factorId, code);
      setEnrollment(null);
      setCode("");
      await loadFactors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(factorId: string) {
    if (!window.confirm("¿Eliminar este factor de verificación en dos pasos? Tu cuenta quedará menos protegida.")) return;
    setError(null);
    try {
      await unenrollMfa(factorId);
      await loadFactors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el factor.");
    }
  }

  return (
    <AuthGuard fallback={<p className="k-p-8 k-text-sm">Inicia sesión para ver tu seguridad.</p>}>
      <div className="k-mx-auto k-flex k-max-w-md k-flex-col k-gap-6 k-p-8">
        <div className="k-flex k-items-center k-justify-between">
          <h1 className="k-text-2xl k-font-bold">Seguridad</h1>
          <Link href="/" className="k-text-sm k-text-muted-foreground hover:k-underline">
            Volver
          </Link>
        </div>

        <Card className="k-flex k-flex-col k-gap-3">
          <p className="k-text-sm k-font-semibold">Verificación en dos pasos (TOTP)</p>
          {factors.length === 0 && <p className="k-text-sm k-text-muted-foreground">No tienes MFA activado.</p>}
          <div className="k-flex k-flex-col k-gap-2">
            {factors.map((factor) => (
              <div
                key={factor.id}
                className="k-flex k-items-center k-justify-between k-rounded-lg k-border k-border-border k-p-3 k-text-sm"
              >
                <span className="k-flex k-items-center k-gap-2">
                  {factor.friendlyName ?? "Autenticador"}
                  <Badge variant={factor.status === "verified" ? "success" : "warning"}>
                    {factor.status === "verified" ? "activo" : "pendiente"}
                  </Badge>
                </span>
                <button
                  type="button"
                  onClick={() => void removeFactor(factor.id)}
                  className="k-text-sm k-text-destructive hover:k-underline"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </Card>

        {error && <p className="k-text-sm k-text-destructive">{error}</p>}

        {!enrollment ? (
          <button
            type="button"
            onClick={() => void startEnrollment()}
            className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground"
          >
            + Activar verificación en dos pasos
          </button>
        ) : (
          <Card>
            <form onSubmit={confirmEnrollment} className="k-flex k-flex-col k-items-center k-gap-3">
              <p className="k-text-sm">Escanea este código con Google Authenticator, Authy, etc.</p>
              {/* Plain <img>, not next/image — qrCode is an SVG data URI from Supabase, not an optimizable asset */}
              <img src={enrollment.qrCode} alt="Código QR para MFA" width={200} height={200} />
              <p className="k-text-xs k-text-muted-foreground">O ingresa el secreto manualmente: {enrollment.secret}</p>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Código de 6 dígitos"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="k-w-full k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-center k-text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="k-w-full k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
              >
                {busy ? "Verificando..." : "Confirmar"}
              </button>
            </form>
          </Card>
        )}
      </div>
    </AuthGuard>
  );
}
