"use client";

import { useAuth } from "@kontrolia/react";
import { AuthShell } from "@kontrolia/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { resolveRedirectTarget } from "@/lib/redirect";

const CODE_LENGTH = 6;

// useSearchParams() requires a Suspense boundary in the App Router.
export default function MfaChallengePage() {
  return (
    <Suspense fallback={<Loading />}>
      <MfaChallengeInner />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="k-flex k-min-h-screen k-items-center k-justify-center">
      <p className="k-text-sm k-text-muted-foreground">Cargando...</p>
    </div>
  );
}

function MfaChallengeInner() {
  const router = useRouter();
  const { isAuthenticated, isLoading, getAuthenticatorAssuranceLevel, listMfaFactors, challengeMfa, verifyMfaChallenge } =
    useAuth();
  const redirectTarget = resolveRedirectTarget(
    useSearchParams().get("redirect_to"),
    typeof window !== "undefined" ? [window.location.origin] : [],
  );

  const [factorId, setFactorId] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function goToRedirectTarget() {
    if (redirectTarget !== "/") window.location.href = redirectTarget;
    else router.push("/");
  }

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      const query = redirectTarget !== "/" ? `?redirect_to=${encodeURIComponent(redirectTarget)}` : "";
      router.push(`/login${query}`);
      return;
    }

    void (async () => {
      const { currentLevel, nextLevel } = await getAuthenticatorAssuranceLevel();
      if (nextLevel !== "aal2" || currentLevel === "aal2") {
        // Nothing pending — either no MFA on this account, or already elevated.
        goToRedirectTarget();
        return;
      }
      const factors = await listMfaFactors();
      const verified = factors.find((f) => f.status === "verified");
      if (!verified) {
        goToRedirectTarget();
        return;
      }
      setFactorId(verified.id);
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading]);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? ""));
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const challengeId = await challengeMfa(factorId);
      await verifyMfaChallenge(factorId, challengeId, digits.join(""));
      goToRedirectTarget();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <Loading />;

  return (
    <AuthShell title="Verificación en dos pasos" subtitle="Ingresa el código de tu app autenticadora.">
      <form onSubmit={handleSubmit} className="k-flex k-flex-col k-gap-5">
        <fieldset className="k-flex k-justify-between k-gap-2">
          <legend className="k-sr-only">Código de verificación de 6 dígitos</legend>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => setDigit(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              autoFocus={index === 0}
              aria-label={`Dígito ${index + 1} de ${CODE_LENGTH}`}
              className="k-h-12 k-w-full k-rounded-lg k-border k-border-border k-bg-background k-text-center k-text-lg k-font-semibold"
            />
          ))}
        </fieldset>
        {error && <p className="k-text-sm k-text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy || digits.some((d) => !d)}
          className="k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
        >
          {busy ? "Verificando..." : "Verificar"}
        </button>
      </form>
    </AuthShell>
  );
}
