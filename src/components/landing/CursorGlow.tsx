"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative pointer-follow glow for the hero backdrop. Purely visual (no
 * layout impact, aria-hidden), and skipped entirely for
 * prefers-reduced-motion so it never fights the user's OS setting.
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const node = ref.current;
    if (!node) return;

    function handleMove(event: MouseEvent) {
      const rect = node!.parentElement!.getBoundingClientRect();
      node!.style.setProperty("--glow-x", `${event.clientX - rect.left}px`);
      node!.style.setProperty("--glow-y", `${event.clientY - rect.top}px`);
    }

    // pointer-events-none excludes this node from hit-testing, so its own
    // CSS :hover can never fire -- track enter/leave on the parent instead
    // and drive visibility through opacity directly.
    function handleEnter() {
      node!.style.opacity = "1";
    }
    function handleLeave() {
      node!.style.opacity = "0";
    }

    const parent = node.parentElement;
    parent?.addEventListener("mousemove", handleMove);
    parent?.addEventListener("mouseenter", handleEnter);
    parent?.addEventListener("mouseleave", handleLeave);
    return () => {
      parent?.removeEventListener("mousemove", handleMove);
      parent?.removeEventListener("mouseenter", handleEnter);
      parent?.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500"
      style={
        {
          background:
            "radial-gradient(320px circle at var(--glow-x, 50%) var(--glow-y, 0px), rgba(52,152,219,0.10), transparent 70%)",
        } as React.CSSProperties
      }
    />
  );
}
