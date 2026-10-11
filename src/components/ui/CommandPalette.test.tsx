// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/stores/app-store";
import { CommandPalette } from "./CommandPalette";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const input = () => screen.queryByPlaceholderText(/search pages/i) as HTMLInputElement | null;
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");

describe("CommandPalette", () => {
  beforeEach(() => {
    useAppStore.setState({ commandPaletteOpen: false });
    push.mockClear();
    // Native Tab containment is verified in Chromium; jsdom only supplies
    // enough of the lifecycle to verify naming, selection and restoration.
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true, value() { this.setAttribute("open", ""); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, "close", {
      configurable: true, value() { this.removeAttribute("open"); },
    });
  });
  afterEach(() => {
    cleanup();
    for (const [name, descriptor] of [["showModal", originalShow], ["close", originalClose]] as const) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  });

  it("focuses on open, filters, unmounts on Escape and reopens empty", async () => {
    render(<CommandPalette />);
    expect(input()).toBeNull();

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const box = await screen.findByPlaceholderText(/search pages/i);
    expect(document.activeElement).toBe(box);

    fireEvent.change(box, { target: { value: "watch" } });
    expect(screen.getByText("Watchlist")).toBeTruthy();
    expect(screen.queryByText("Portfolio")).toBeNull();

    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    await waitFor(() => expect(input()).toBeNull());

    act(() => useAppStore.getState().setCommandPaletteOpen(true));
    expect((await screen.findByPlaceholderText(/search pages/i) as HTMLInputElement).value).toBe("");
  });

  it("navigates to the highlighted item on Enter and closes", async () => {
    push.mockClear();
    render(<CommandPalette />);
    act(() => useAppStore.getState().setCommandPaletteOpen(true));
    const box = await screen.findByPlaceholderText(/search pages/i);

    fireEvent.change(box, { target: { value: "portfolio" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/dashboard/portfolio");
    await waitFor(() => expect(input()).toBeNull());
  });

  it("quick actions deep-link the ticker instead of opening an empty form", async () => {
    push.mockClear();
    render(<CommandPalette />);
    act(() => useAppStore.getState().setCommandPaletteOpen(true));

    fireEvent.click(await screen.findByText("Predict RELIANCE"));
    expect(push).toHaveBeenCalledWith("/dashboard/predict?ticker=RELIANCE.NS");
  });

  it("announces arrow-key selection and restores the opener when dismissed", async () => {
    render(<><button>Search trigger</button><CommandPalette /></>);
    const trigger = screen.getByRole("button", { name: "Search trigger" });
    trigger.focus();
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const box = await screen.findByRole("combobox", { name: "Search pages and actions" });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    const selected = screen.getByRole("option", { name: /AI Prediction Tool/ });
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(box.getAttribute("aria-activedescendant")).toBe(selected.id);
    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps an empty search safe for arrow and Enter keys", async () => {
    render(<CommandPalette />);
    act(() => useAppStore.getState().setCommandPaletteOpen(true));
    const box = await screen.findByRole("combobox");
    fireEvent.change(box, { target: { value: "no-such-page" } });
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(box.getAttribute("aria-activedescendant")).toBeNull();
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "portfolio" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/dashboard/portfolio");
  });
});
