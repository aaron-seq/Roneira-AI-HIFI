// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/lib/stores/app-store";
import { CommandPalette } from "./CommandPalette";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const input = () => screen.queryByPlaceholderText(/search pages/i) as HTMLInputElement | null;

// Covers the three things PR #139's restructure could break and nothing in a
// node-environment test could see: autoFocus inside AnimatePresence, the exit
// propagating through the child so it actually unmounts, and the query
// resetting on reopen because state lives in the unmounted child.
describe("CommandPalette", () => {
  it("focuses on open, filters, unmounts on Escape and reopens empty", async () => {
    render(<CommandPalette />);
    expect(input()).toBeNull();

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const box = await screen.findByPlaceholderText(/search pages/i);
    expect(document.activeElement).toBe(box);

    fireEvent.change(box, { target: { value: "watch" } });
    expect(screen.getByText("Watchlist")).toBeTruthy();
    expect(screen.queryByText("Portfolio")).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
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
});
