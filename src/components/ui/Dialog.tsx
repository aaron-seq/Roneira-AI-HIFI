"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  /** Classes for the content panel; the native dialog covers the viewport. */
  className?: string;
  dismissible?: boolean;
  children: ReactNode;
};

/** Native modality supplies background inertness and keyboard focus containment. */
export function Dialog({
  open, onClose, labelledBy, describedBy, className, dismissible = true, children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    const initial = dialog.querySelector<HTMLElement>("[data-dialog-autofocus]")
      ?? dialog.querySelector<HTMLElement>(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]"
      );
    initial?.focus();

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-modal="true"
      tabIndex={-1}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center overflow-hidden border-0 bg-transparent p-4 backdrop:bg-black/60 [&[open]]:flex"
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.defaultPrevented) return;
        // Native modality makes the background inert; explicitly wrap the
        // endpoints so Tab also stays in the dialog instead of browser chrome.
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, [tabindex]'
        )).filter((element) => element.tabIndex >= 0 && !element.matches(":disabled")
          && !element.closest("[hidden], [inert]") && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          event.currentTarget.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div className={cn(
        "relative max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text-primary)] shadow-xl",
        className
      )}>
        {children}
      </div>
    </dialog>
  );
}
