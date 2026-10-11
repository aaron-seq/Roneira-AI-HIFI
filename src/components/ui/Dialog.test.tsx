// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { Dialog } from "./Dialog";

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

function Harness({ dismissible = true }: { dismissible?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Open editor</button>
    <Dialog open={open} onClose={() => setOpen(false)} labelledBy="editor-title" dismissible={dismissible}>
      <h2 id="editor-title">Edit holding</h2>
      <button onClick={() => setOpen(false)}>Close editor</button>
      <label htmlFor="quantity">Quantity</label>
      <input id="quantity" data-dialog-autofocus />
    </Dialog>
  </>;
}

describe("Dialog lifecycle and dismissal", () => {
  beforeEach(() => {
    // jsdom has no native dialog lifecycle/focus containment implementation.
    // Browser checks cover those; this mock exposes the component's contract.
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true, value() { this.setAttribute("open", ""); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true, value() { this.removeAttribute("open"); },
    });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    for (const [name, descriptor] of [["showModal", originalShow], ["close", originalClose]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
    document.body.style.overflow = "";
  });

  it("focuses the marked input, restores the opener and supports reopening", () => {
    document.body.style.overflow = "clip";
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open editor" });
    for (let attempt = 0; attempt < 2; attempt++) {
      opener.focus(); fireEvent.click(opener);
      expect(document.activeElement).toBe(screen.getByLabelText("Quantity"));
      expect(document.body.style.overflow).toBe("hidden");
      const dialog = screen.getByRole("dialog", { name: "Edit holding" });
      expect(dialog.hasAttribute("open")).toBe(true);
      const cancel = new Event("cancel", { cancelable: true });
      fireEvent(dialog, cancel);
      expect(cancel.defaultPrevented).toBe(true);
      expect(dialog.hasAttribute("open")).toBe(false);
      expect(document.activeElement).toBe(opener);
      expect(document.body.style.overflow).toBe("clip");
    }
  });

  it("dismisses root backdrop clicks while preserving clicks inside the panel", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    const dialog = screen.getByRole("dialog", { name: "Edit holding" });
    fireEvent.click(screen.getByText("Edit holding"));
    expect(dialog.hasAttribute("open")).toBe(true);
    fireEvent.click(dialog);
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("keeps a pending operation open on Escape or backdrop click", () => {
    render(<Harness dismissible={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    const dialog = screen.getByRole("dialog", { name: "Edit holding" });
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog);
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("wraps Tab at both endpoints instead of leaving the modal", () => {
    // jsdom has no layout; Chromium checks actual visibility and inertness.
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue({ length: 1 } as DOMRectList);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    const last = screen.getByLabelText("Quantity");
    const first = screen.getByRole("button", { name: "Close editor" });
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
