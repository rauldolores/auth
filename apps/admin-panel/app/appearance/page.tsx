"use client";

import { useAuth } from "@kontrolia/react";
import { Card, ForbiddenScreen } from "@kontrolia/ui";
import { useEffect, useRef, useState } from "react";

const AUTH_SERVER_URL = process.env.NEXT_PUBLIC_AUTH_SERVER_URL;

type Theme = "light" | "dark" | "system";

interface InstanceSettings {
  registrationEnabled: boolean;
  theme: Theme;
  buttonColor: string | null;
  logoUrl: string | null;
}

const DEFAULT_BUTTON_COLOR = "#6d5ef8";

function ImageIcon({ className = "k-w-5 k-h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"
      />
      <circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" />
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

export default function AppearancePage() {
  const { isPlatformAdmin, getToken } = useAuth();
  const [platformAdminChecked, setPlatformAdminChecked] = useState(false);
  const [platformAdmin, setPlatformAdmin] = useState(false);

  const [settings, setSettings] = useState<InstanceSettings | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [theme, setTheme] = useState<Theme>("system");
  const [buttonColor, setButtonColor] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void isPlatformAdmin().then((result) => {
      setPlatformAdmin(result);
      setPlatformAdminChecked(true);
    });
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (!platformAdmin) return;
    void fetch(`${AUTH_SERVER_URL}/api/instance-settings`)
      .then((res) => res.json() as Promise<InstanceSettings>)
      .then((data) => {
        setSettings(data);
        setRegistrationEnabled(data.registrationEnabled);
        setTheme(data.theme);
        setButtonColor(data.buttonColor);
      })
      .catch(() => setError("No se pudieron cargar los ajustes."));
  }, [platformAdmin]);

  const dirty =
    settings !== null &&
    (registrationEnabled !== settings.registrationEnabled || theme !== settings.theme || buttonColor !== settings.buttonColor);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccessNotice(null);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/instance-settings`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ registrationEnabled, theme, buttonColor }),
      });
      const body = (await response.json()) as InstanceSettings & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudieron guardar los cambios.");
      setSettings(body);
      setSuccessNotice("Cambios guardados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoSelected(file: File) {
    setUploadingLogo(true);
    setError(null);
    setSuccessNotice(null);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${AUTH_SERVER_URL}/api/instance-settings/logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const body = (await response.json()) as { logoUrl?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo subir el logo.");
      setSettings((prev) => (prev ? { ...prev, logoUrl: body.logoUrl ?? null } : prev));
      setSuccessNotice("Logo actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el logo.");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    setUploadingLogo(true);
    setError(null);
    setSuccessNotice(null);
    try {
      const token = await getToken();
      const response = await fetch(`${AUTH_SERVER_URL}/api/instance-settings/logo`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await response.json()) as InstanceSettings & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo quitar el logo.");
      setSettings(body);
      setSuccessNotice("Logo quitado — vuelve a mostrarse el logo de KontrolIA Auth.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  if (!platformAdminChecked) {
    return <p className="k-p-8 k-text-sm k-text-muted-foreground">Cargando...</p>;
  }

  if (!platformAdmin) {
    return (
      <ForbiddenScreen description="Solo un platform admin puede personalizar la apariencia de las pantallas de autenticación." />
    );
  }

  return (
    <div className="k-flex k-max-w-2xl k-flex-col k-gap-6">
      <div>
        <h1 className="k-text-xl k-font-bold">Apariencia</h1>
        <p className="k-mt-1 k-text-sm k-text-muted-foreground">
          Controla cómo se ven y se comportan las pantallas de inicio de sesión, registro y recuperación de
          contraseña — lo que ve cualquier persona en auth-server, antes de iniciar sesión.
        </p>
      </div>

      {error && <p className="k-rounded-lg k-bg-destructive/10 k-p-3 k-text-sm k-text-destructive">{error}</p>}
      {successNotice && <p className="k-rounded-lg k-bg-success/10 k-p-3 k-text-sm k-text-success">{successNotice}</p>}

      {settings === null ? (
        <p className="k-text-sm k-text-muted-foreground">Cargando ajustes...</p>
      ) : (
        <>
          <Card className="k-flex k-flex-col k-gap-4 k-p-5">
            <div className="k-flex k-items-start k-justify-between k-gap-4">
              <div>
                <p className="k-text-sm k-font-semibold">Permitir que la gente cree su propia cuenta</p>
                <p className="k-mt-0.5 k-text-xs k-text-muted-foreground">
                  Si lo desactivas, se oculta el enlace y el formulario de "Crear cuenta" — la única forma de sumar
                  gente será que un Owner o Admin la invite desde Usuarios. Nota: esto controla la interfaz; alguien
                  con acceso directo a la API de Supabase podría seguir registrándose — para bloquearlo también a
                  ese nivel, deshabilita el registro público en la configuración de tu proyecto Supabase/GoTrue.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={registrationEnabled}
                onClick={() => setRegistrationEnabled((v) => !v)}
                className={`k-relative k-h-6 k-w-11 k-shrink-0 k-rounded-full k-transition-colors ${
                  registrationEnabled ? "k-bg-primary" : "k-bg-muted"
                }`}
              >
                <span
                  className={`k-absolute k-top-0.5 k-h-5 k-w-5 k-rounded-full k-bg-white k-shadow k-transition-transform ${
                    registrationEnabled ? "k-translate-x-[22px]" : "k-translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </Card>

          <Card className="k-flex k-flex-col k-gap-3 k-p-5">
            <p className="k-text-sm k-font-semibold">Tema</p>
            <div className="k-flex k-gap-2">
              {(
                [
                  { value: "system", label: "Sistema" },
                  { value: "light", label: "Claro" },
                  { value: "dark", label: "Oscuro" },
                ] as { value: Theme; label: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTheme(option.value)}
                  className={`k-rounded-lg k-border k-px-3 k-py-1.5 k-text-sm k-font-medium k-transition-all ${
                    theme === option.value
                      ? "k-border-primary k-bg-primary/10 k-text-primary"
                      : "k-border-border k-text-muted-foreground hover:k-bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="k-text-xs k-text-muted-foreground">
              "Sistema" sigue la preferencia del navegador de cada visitante — es lo normal. "Claro"/"Oscuro" lo
              fuerzan siempre, sin importar el dispositivo.
            </p>
          </Card>

          <Card className="k-flex k-flex-col k-gap-3 k-p-5">
            <p className="k-text-sm k-font-semibold">Color de los botones</p>
            <div className="k-flex k-items-center k-gap-3">
              <input
                type="color"
                value={buttonColor ?? DEFAULT_BUTTON_COLOR}
                onChange={(e) => setButtonColor(e.target.value)}
                className="k-h-9 k-w-9 k-cursor-pointer k-rounded-md k-border k-border-border k-p-0.5"
                aria-label="Color de los botones"
              />
              <input
                type="text"
                value={buttonColor ?? ""}
                placeholder={DEFAULT_BUTTON_COLOR}
                onChange={(e) => setButtonColor(e.target.value || null)}
                className="k-w-32 k-rounded-md k-border k-border-border k-bg-background k-px-3 k-py-1.5 k-font-mono k-text-sm"
              />
              {buttonColor && (
                <button
                  type="button"
                  onClick={() => setButtonColor(null)}
                  className="k-text-xs k-font-medium k-text-muted-foreground hover:k-underline"
                >
                  Restablecer al morado por defecto
                </button>
              )}
            </div>
          </Card>

          <div className="k-flex k-justify-end">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => void handleSave()}
              className="k-inline-flex k-items-center k-gap-2 k-rounded-lg k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-50"
            >
              {saving && <SpinnerIcon />}
              Guardar cambios
            </button>
          </div>

          <Card className="k-flex k-flex-col k-gap-3 k-p-5">
            <p className="k-text-sm k-font-semibold">Logo</p>
            <p className="k-text-xs k-text-muted-foreground">
              Reemplaza el logo de KontrolIA Auth en las pantallas de autenticación. PNG, JPG, SVG o WebP, hasta 2MB.
            </p>
            <div className="k-flex k-items-center k-gap-4">
              <div className="k-flex k-h-14 k-w-14 k-shrink-0 k-items-center k-justify-center k-rounded-lg k-border k-border-border k-bg-muted/40">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo actual" className="k-max-h-full k-max-w-full k-object-contain" />
                ) : (
                  <ImageIcon className="k-w-6 k-h-6 k-text-muted-foreground" />
                )}
              </div>
              <div className="k-flex k-flex-col k-gap-2">
                <div className="k-flex k-gap-2">
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => fileInputRef.current?.click()}
                    className="k-rounded-lg k-border k-border-border k-px-3 k-py-1.5 k-text-sm k-font-medium hover:k-bg-muted disabled:k-opacity-50"
                  >
                    {uploadingLogo ? "Subiendo..." : settings.logoUrl ? "Reemplazar" : "Subir logo"}
                  </button>
                  {settings.logoUrl && (
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => void handleRemoveLogo()}
                      className="k-rounded-lg k-border k-border-border k-px-3 k-py-1.5 k-text-sm k-font-medium k-text-destructive hover:k-bg-destructive/10 disabled:k-opacity-50"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="k-hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleLogoSelected(file);
                  }}
                />
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
