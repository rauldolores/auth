"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "./nav";

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="k-mx-auto k-flex k-max-w-6xl">
      <aside className="k-sticky k-top-0 k-h-screen k-w-64 k-shrink-0 k-overflow-y-auto k-border-r k-border-border k-p-6">
        <Link href="/docs" className="k-mb-6 k-block k-text-sm k-font-semibold">
          KontrolIA Auth
        </Link>
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="k-mb-5">
            <p className="k-mb-1.5 k-text-xs k-font-medium k-uppercase k-tracking-wide k-text-muted-foreground">
              {group.title}
            </p>
            <nav className="k-flex k-flex-col k-gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "k-rounded-md k-px-2 k-py-1.5 k-text-sm " +
                      (active ? "k-bg-muted k-font-medium" : "k-text-muted-foreground hover:k-bg-muted")
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </aside>
      <main className="k-min-w-0 k-flex-1 k-px-10 k-py-10">
        <div className="k-prose k-mx-auto k-max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
