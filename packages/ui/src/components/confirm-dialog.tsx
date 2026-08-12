"use client";

import { useState } from "react";
import { Dialog } from "./dialog.js";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red solid button for destructive actions (remove, revoke, disable); the default primary style otherwise. */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Covers the common case of the 11 window.confirm() call sites this
 * replaces — a title, an explanatory sentence, and a confirm/cancel pair.
 * `onConfirm` may be async; the confirm button disables itself and shows
 * "..." while it's in flight so a double-click can't fire the mutation
 * twice, then closes the dialog only after it resolves.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleConfirm() {
    setIsConfirming(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="k-flex k-justify-end k-gap-3">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={isConfirming}
          className="k-rounded-md k-px-4 k-py-2 k-text-sm k-font-medium k-text-muted-foreground hover:k-bg-muted disabled:k-opacity-60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={isConfirming}
          className={
            destructive
              ? "k-rounded-md k-bg-destructive k-px-4 k-py-2 k-text-sm k-font-medium k-text-destructive-foreground disabled:k-opacity-60"
              : "k-rounded-md k-bg-primary k-px-4 k-py-2 k-text-sm k-font-medium k-text-primary-foreground disabled:k-opacity-60"
          }
        >
          {isConfirming ? "..." : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
