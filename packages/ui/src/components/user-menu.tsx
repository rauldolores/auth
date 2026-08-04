"use client";

import { useAuth } from "@kontrolia/react";
import { useState } from "react";
import { cn } from "../lib/cn.js";
import { Avatar } from "./avatar.js";

export interface UserMenuProps {
  className?: string;
  onLogout?: () => void;
}

export function UserMenu({ className, onLogout }: UserMenuProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  async function handleLogout() {
    await logout();
    onLogout?.();
  }

  return (
    <div className={cn("k-relative k-inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="k-flex k-items-center k-gap-2 k-rounded-md k-px-2 k-py-1.5 hover:k-bg-muted"
      >
        <Avatar name={user.fullName ?? user.email} src={user.avatarUrl} />
        <span className="k-text-sm">{user.fullName ?? user.email}</span>
      </button>
      {open && (
        <div className="k-absolute k-right-0 k-mt-1 k-w-48 k-rounded-md k-border k-border-border k-bg-background k-p-1 k-shadow-md">
          <button
            type="button"
            onClick={handleLogout}
            className="k-w-full k-rounded-sm k-px-2 k-py-1.5 k-text-left k-text-sm hover:k-bg-muted"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
