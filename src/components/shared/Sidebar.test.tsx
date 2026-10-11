// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes } from "react";
import { useAppStore } from "@/lib/stores/app-store";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/portfolio" }));
vi.mock("next/image", () => ({ default: () => <span aria-hidden="true" /> }));
vi.mock("next/link", () => ({ default: ({ onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) =>
  <a {...props} onClick={(event) => { event.preventDefault(); onClick?.(event); }} />,
}));

const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
let onMediaChange: () => void;
let desktop: boolean;

function Harness() {
  return <>
    <button onClick={() => useAppStore.getState().setMobileSidebarOpen(true)}>Open navigation</button>
    <Sidebar />
  </>;
}

describe("responsive sidebar contract", () => {
  beforeEach(() => {
    desktop = false;
    vi.stubGlobal("matchMedia", () => ({
      get matches() { return desktop; },
      addEventListener: (_event: string, callback: () => void) => { onMediaChange = callback; },
      removeEventListener: vi.fn(),
    }));
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
    Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
    useAppStore.setState({ sidebarCollapsed: false, mobileSidebarOpen: false, user: null, commandPaletteOpen: false });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    for (const [name, descriptor] of [["showModal", show], ["close", close]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
    document.body.style.overflow = "";
    useAppStore.setState({ sidebarCollapsed: false, mobileSidebarOpen: false, commandPaletteOpen: false });
  });

  it("retains accessible navigation names and active state when desktop labels collapse", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(screen.getByRole("link", { name: "Portfolio" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Watchlist" }).getAttribute("aria-label")).toBe("Watchlist");
    expect(screen.getByRole("button", { name: "Expand navigation" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("opens a labelled drawer, closes on cancel and restores scroll/focus", () => {
    document.body.style.overflow = "clip";
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    trigger.focus(); fireEvent.click(trigger);
    const drawer = screen.getByRole("dialog", { name: "Navigation" });
    expect(document.activeElement).toBe(within(drawer).getByRole("button", { name: "Close navigation" }));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent(drawer, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe("clip");
  });

  it("closes after navigating and when resized to desktop", () => {
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Portfolio" }));
    expect(useAppStore.getState().mobileSidebarOpen).toBe(false);
    fireEvent.click(trigger);
    act(() => { desktop = true; onMediaChange(); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes mobile navigation before opening the command palette", () => {
    useAppStore.getState().setMobileSidebarOpen(true);
    useAppStore.getState().setCommandPaletteOpen(true);
    expect(useAppStore.getState().mobileSidebarOpen).toBe(false);
    expect(useAppStore.getState().commandPaletteOpen).toBe(true);
  });
});
