"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "./nav";

export function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="k-flex k-flex-col k-gap-8 lg:k-flex-row lg:k-items-start">
      {/* DOM order keeps the menu first on mobile (nav before content reads
          naturally on a small screen); lg:order-2 moves it to the right
          only once there's room for a two-column layout. */}
      <aside className="k-w-full k-shrink-0 k-rounded-xl k-border k-border-border k-bg-card k-p-4 lg:k-order-2 lg:k-sticky lg:k-top-8 lg:k-w-56">
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
      <main className="k-min-w-0 k-flex-1 lg:k-order-1">
        <div className="k-prose k-max-w-2xl">{children}</div>
      </main>
    </div>
  );
}
