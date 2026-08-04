import { cn } from "../lib/cn.js";

interface StatusScreenProps {
  className?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

function StatusScreen({ className, title, description, action }: StatusScreenProps) {
  return (
    <div className={cn("k-flex k-min-h-[60vh] k-flex-col k-items-center k-justify-center k-gap-3 k-text-center", className)}>
      <h1 className="k-text-2xl k-font-semibold">{title}</h1>
      <p className="k-max-w-sm k-text-sm k-text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function UnauthorizedScreen(props: Omit<StatusScreenProps, "title" | "description"> & Partial<Pick<StatusScreenProps, "title" | "description">>) {
  return (
    <StatusScreen
      title={props.title ?? "401 — No autenticado"}
      description={props.description ?? "Necesitas iniciar sesión para ver esta página."}
      {...props}
    />
  );
}

export function ForbiddenScreen(props: Omit<StatusScreenProps, "title" | "description"> & Partial<Pick<StatusScreenProps, "title" | "description">>) {
  return (
    <StatusScreen
      title={props.title ?? "403 — Sin permisos"}
      description={props.description ?? "Tu cuenta no tiene permiso para acceder a esta página."}
      {...props}
    />
  );
}

export function SessionExpiredScreen(props: Omit<StatusScreenProps, "title" | "description"> & Partial<Pick<StatusScreenProps, "title" | "description">>) {
  return (
    <StatusScreen
      title={props.title ?? "Sesión expirada"}
      description={props.description ?? "Tu sesión expiró por seguridad. Inicia sesión de nuevo para continuar."}
      {...props}
    />
  );
}
