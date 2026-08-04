"use client";

import { useAuth } from "@kontrolia/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function MfaChallengePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, getAuthenticatorAssuranceLevel, listMfaFactors, challengeMfa, verifyMfaChallenge } =
    useAuth();

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    void (async () => {
      const { currentLevel, nextLevel } = await getAuthenticatorAssuranceLevel();
      if (nextLevel !== "aal2" || currentLevel === "aal2") {
        // Nothing pending — either no MFA on this account, or already elevated.
        router.push("/");
        return;
      }
      const factors = await listMfaFactors();
      const verified = factors.find((f) => f.status === "verified");
      if (!verified) {
        router.push("/");
        return;
      }
      setFactorId(verified.id);
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const challengeId = await challengeMfa(factorId);
      await verifyMfaChallenge(factorId, challengeId, code);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <p className="k-p-8 k-text-center k-text-sm k-text-muted-foreground">Cargando...</p>;
  }

  return (
    <div className="k-mx-auto k-flex k-min-h-screen k-max-w-sm k-flex-col k-justify-center k-gap-6 k-px-4">
      <h1 className="k-text-xl k-font-semibold">Verificación en dos pasos</h1>
      <p className="k-text-sm k-text-muted-foreground">Ingresa el código de tu app autenticadora.</p>
      <form onSubmit={handleSubmit} className="k-flex k-flex-col k-gap-3">
        <input
          type="text"
          inputMode="numeric"
          placeholder="Código de 6 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          autoFocus
          className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-2 k-text-center k-text-sm"
        />
        {error && <p className="k-text-sm k-text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
        >
          {busy ? "Verificando..." : "Confirmar"}
        </button>
      </form>
    </div>
  );
}
