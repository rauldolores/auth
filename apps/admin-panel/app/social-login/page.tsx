"use client";

import { useAuth } from "@kontrolia/react";
import { Card, ForbiddenScreen } from "@kontrolia/ui";
import { useEffect, useState } from "react";

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`;

type Provider = "google" | "azure";

interface ProviderStatus {
  liveEnabled: boolean;
  configured: boolean;
  clientId: string | null;
  tenantUrl?: string | null;
}

interface SocialLoginStatus {
  managementApiAvailable: boolean;
  google: ProviderStatus;
  azure: ProviderStatus;
}

const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", azure: "Microsoft (Azure AD / Entra ID)" };
const CONSOLE_LINK: Record<Provider, { label: string; href: string }> = {
  google: { label: "Google Cloud Console → Credenciales", href: "https://console.cloud.google.com/apis/credentials" },
  azure: {
    label: "Azure Portal → Registro de aplicaciones",
    href: "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
  },
};

function SpinnerIcon({ className = "k-w-4 k-h-4" }: { className?: string }) {
  return (
    <svg className={`k-animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="k-opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="k-opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="k-text-xs k-font-medium k-text-muted-foreground">{label}</p>
      <div className="k-mt-1 k-flex k-items-center k-gap-2">
        <code className="k-flex-1 k-truncate k-rounded-md k-border k-border-border k-bg-muted/40 k-px-2 k-py-1.5 k-text-xs">{value}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="k-shrink-0 k-rounded-md k-border k-border-border k-px-2 k-py-1.5 k-text-xs k-font-medium hover:k-bg-muted"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`k-inline-flex k-items-center k-gap-1.5 k-rounded-full k-px-2.5 k-py-0.5 k-text-xs k-font-medium ${
        enabled ? "k-bg-success/10 k-text-success" : "k-bg-muted k-text-muted-foreground"
      }`}
    >
      <span className={`k-h-1.5 k-w-1.5 k-rounded-full ${enabled ? "k-bg-success" : "k-bg-muted-foreground"}`} />
      {enabled ? "Activo" : "Inactivo"}
    </span>
  );
}

function ProviderCard({
  provider,
  status,
  managementApiAvailable,
  onSaved,
}: {
  provider: Provider;
  status: ProviderStatus;
  managementApiAvailable: boolean;
  onSaved: (status: SocialLoginStatus) => void;
}) {
  const { getToken } = useAuth();
  const [enabled, setEnabled] = useState(status.liveEnabled);
  const [clientId, setClientId] = useState(status.clientId ?? "");
  const [secret, setSecret] = useState("");
  const [tenantUrl, setTenantUrl] = useState(status.tenantUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(status.liveEnabled);
    setClientId(status.clientId ?? "");
    setTenantUrl(status.tenantUrl ?? "");
    setSecret("");
  }, [status]);

  const dirty = enabled !== status.liveEnabled || clientId !== (status.clientId ?? "") || secret !== "" || tenantUrl !== (status.tenantUrl ?? "");

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccessNotice(null);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/social-login?provider=${provider}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          clientId: clientId.trim() || undefined,
          secret: secret || undefined,
          ...(provider === "azure" ? { tenantUrl: tenantUrl.trim() || undefined } : {}),
        }),
      });
      const body = (await response.json()) as SocialLoginStatus & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudieron guardar los cambios.");
      onSaved(body);
      setSuccessNotice("Cambios guardados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="k-flex k-flex-col k-gap-4 k-p-5">
      <div className="k-flex k-items-center k-justify-between">
        <p className="k-text-sm k-font-semibold">{PROVIDER_LABEL[provider]}</p>
        <StatusBadge enabled={status.liveEnabled} />
      </div>

      {!managementApiAvailable ? (
        <p className="k-text-xs k-text-muted-foreground">
          Esta instalación no tiene configurada la API de administración de Supabase, así que este proveedor solo se
          puede activar directamente en{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="k-text-primary hover:k-underline">
            el dashboard de tu proyecto Supabase
          </a>{" "}
          (Authentication → Providers) — o en <code>docker/.env</code> si es una instalación self-hosted. Consulta la{" "}
          <a href="/docs/guides/social-login" className="k-text-primary hover:k-underline">
            guía completa
          </a>
          . El estado de arriba siempre refleja la realidad, sin importar dónde se haya configurado.
        </p>
      ) : (
        <>
          {error && <p className="k-rounded-lg k-bg-destructive/10 k-p-3 k-text-sm k-text-destructive">{error}</p>}
          {successNotice && <p className="k-rounded-lg k-bg-success/10 k-p-3 k-text-sm k-text-success">{successNotice}</p>}

          <div className="k-flex k-items-start k-justify-between k-gap-4">
            <div>
              <p className="k-text-sm k-font-medium">Activar</p>
              <p className="k-mt-0.5 k-text-xs k-text-muted-foreground">
                Muestra el botón "Continuar con {PROVIDER_LABEL[provider].split(" ")[0]}" en el login y registro.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((v) => !v)}
              className={`k-relative k-h-6 k-w-11 k-shrink-0 k-rounded-full k-transition-colors ${enabled ? "k-bg-primary" : "k-bg-muted"}`}
            >
              <span
                className={`k-absolute k-top-0.5 k-h-5 k-w-5 k-rounded-full k-bg-white k-shadow k-transition-transform ${
                  enabled ? "k-translate-x-[22px]" : "k-translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <div className="k-flex k-flex-col k-gap-3">
            <label className="k-flex k-flex-col k-gap-1">
              <span className="k-text-xs k-font-medium k-text-muted-foreground">Client ID</span>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Obtenlo al registrar la app en la consola del proveedor"
                className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-1.5 k-text-sm"
              />
            </label>
            <label className="k-flex k-flex-col k-gap-1">
              <span className="k-text-xs k-font-medium k-text-muted-foreground">Client Secret</span>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={status.configured ? "Dejar en blanco para no cambiarlo" : "Requerido para activar"}
                className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-1.5 k-text-sm"
              />
            </label>
            {provider === "azure" && (
              <label className="k-flex k-flex-col k-gap-1">
                <span className="k-text-xs k-font-medium k-text-muted-foreground">URL del tenant (opcional)</span>
                <input
                  type="text"
                  value={tenantUrl}
                  onChange={(e) => setTenantUrl(e.target.value)}
                  placeholder="https://login.microsoftonline.com/<tenant-id>/v2.0"
                  className="k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-1.5 k-text-sm"
                />
              </label>
            )}
          </div>

          <CopyField label="Redirect URI — pégala al registrar la app en el proveedor" value={REDIRECT_URI} />

          <div className="k-flex k-items-center k-justify-between k-gap-3">
            <a href={CONSOLE_LINK[provider].href} target="_blank" rel="noreferrer" className="k-text-xs k-font-medium k-text-primary hover:k-underline">
              {CONSOLE_LINK[provider].label} ↗
            </a>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void handleSave()}
              className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-50"
            >
              {saving && <SpinnerIcon />}
              Guardar
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

export default function SocialLoginPage() {
  const { isPlatformAdmin, getToken } = useAuth();
  const [platformAdminChecked, setPlatformAdminChecked] = useState(false);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [status, setStatus] = useState<SocialLoginStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void isPlatformAdmin().then((result) => {
      setPlatformAdmin(result);
      setPlatformAdminChecked(true);
    });
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (!platformAdmin) return;
    void (async () => {
      try {
        const token = await getToken();
        const response = await fetch(`${AUTH_SERVER_URL}/api/social-login`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error();
        setStatus((await response.json()) as SocialLoginStatus);
      } catch {
        setLoadError("No se pudo cargar el estado de los proveedores.");
      }
    })();
  }, [platformAdmin, getToken]);

  if (!platformAdminChecked) {
    return <p className="k-p-8 k-text-sm k-text-muted-foreground">Cargando...</p>;
  }

  if (!platformAdmin) {
    return <ForbiddenScreen description="Solo un platform admin puede configurar el inicio de sesión social." />;
  }

  return (
    <div className="k-flex k-max-w-2xl k-flex-col k-gap-6">
      <div>
        <h1 className="k-text-xl k-font-bold">Inicio de sesión social</h1>
        <p className="k-mt-1 k-text-sm k-text-muted-foreground">
          Activa "Continuar con Google" o "Continuar con Microsoft" en el login y registro. El estado de cada
          proveedor es el real, en vivo — nunca depende de un despliegue o reinicio.
        </p>
      </div>

      {loadError && <p className="k-rounded-lg k-bg-destructive/10 k-p-3 k-text-sm k-text-destructive">{loadError}</p>}

      {status === null && !loadError ? (
        <p className="k-text-sm k-text-muted-foreground">Cargando...</p>
      ) : status ? (
        <>
          <ProviderCard provider="google" status={status.google} managementApiAvailable={status.managementApiAvailable} onSaved={setStatus} />
          <ProviderCard provider="azure" status={status.azure} managementApiAvailable={status.managementApiAvailable} onSaved={setStatus} />
        </>
      ) : null}
    </div>
  );
}
