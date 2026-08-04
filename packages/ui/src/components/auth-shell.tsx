import { cn } from "../lib/cn.js";

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Chrome shared by every hosted auth screen (login, register, MFA challenge,
 * password reset, invitation acceptance): logo mark + wordmark above a
 * centered card. Keeps each page responsible only for its form.
 */
export function AuthShell({ title, subtitle, className, children }: AuthShellProps) {
  return (
    <div className="k-flex k-min-h-screen k-items-center k-justify-center k-bg-background k-px-4 k-py-10">
      <div className="k-w-full k-max-w-sm">
        <div className="k-mb-6 k-flex k-items-center k-gap-2.5">
          <div className="k-flex k-h-9 k-w-9 k-shrink-0 k-items-center k-justify-center k-rounded-lg k-bg-gradient-to-br k-from-primary k-to-[#4c2a8c] k-text-base k-font-extrabold k-text-white">
            K
          </div>
          <span className="k-text-base k-font-extrabold">KontrolIA Auth</span>
        </div>
        <div className={cn("k-rounded-2xl k-border k-border-border k-bg-card k-p-7 k-shadow-sm", className)}>
          <h1 className="k-mb-1 k-text-xl k-font-bold">{title}</h1>
          {subtitle && <p className="k-mb-5 k-text-sm k-text-muted-foreground">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
