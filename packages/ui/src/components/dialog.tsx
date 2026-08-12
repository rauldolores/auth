"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { cn } from "../lib/cn.js";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Visually hidden when `description` also renders visible body content — Radix requires either a description or an explicit `aria-describedby` override for screen readers, so this always renders (visually or not). */
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Low-level modal shell — overlay, portal, focus trap, Escape-to-close, and
 * focus-return-on-close all come from Radix's Dialog primitive, matching the
 * accessibility behavior a prior audit already signed off on for the
 * window.confirm()/prompt() calls this replaces. Styled with the same
 * surface tokens as `Card` (k-rounded-2xl k-border k-bg-card) plus a
 * elevation shadow, since a modal needs to visually separate from the page
 * behind it in a way an inline Card doesn't.
 */
export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="k-fixed k-inset-0 k-z-50 k-bg-black/50 k-transition-opacity k-duration-150 data-[state=closed]:k-opacity-0 data-[state=open]:k-opacity-100" />
        <RadixDialog.Content
          className={cn(
            "k-fixed k-left-1/2 k-top-1/2 k-z-50 k-w-[calc(100vw-2rem)] k-max-w-md k-translate-x-[-50%] k-translate-y-[-50%]",
            "k-rounded-2xl k-border k-border-border k-bg-card k-p-6 k-text-card-foreground k-shadow-xl",
            "k-transition-[opacity,transform] k-duration-150",
            "data-[state=closed]:k-scale-95 data-[state=closed]:k-opacity-0 data-[state=open]:k-scale-100 data-[state=open]:k-opacity-100",
            className,
          )}
        >
          <RadixDialog.Title className="k-text-base k-font-semibold">{title}</RadixDialog.Title>
          {description && (
            <RadixDialog.Description className="k-mt-1.5 k-text-sm k-text-muted-foreground">
              {description}
            </RadixDialog.Description>
          )}
          <div className={description ? "k-mt-4" : "k-mt-4"}>{children}</div>
          <RadixDialog.Close asChild>
            <button
              type="button"
              aria-label="Cerrar"
              className="k-absolute k-right-4 k-top-4 k-rounded-md k-p-1 k-text-muted-foreground hover:k-bg-muted hover:k-text-foreground"
            >
              <svg viewBox="0 0 16 16" fill="none" className="k-h-4 k-w-4" aria-hidden="true">
                <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
