// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StockSearch, type StockOption } from "./StockSearch";

const search = vi.hoisted(() => ({ hook: vi.fn(), refetch: vi.fn() }));
vi.mock("@/lib/hooks/use-prediction", () => ({ useStockSearch: search.hook }));

const options = [
  { symbol: "TCS.NS", name: "Tata Consultancy Services", exchange: "NSE" },
  { symbol: "TCS.BO", name: "Tata Consultancy Services", exchange: "BSE" },
];

function Form() {
  const [stock, setStock] = useState<StockOption | null>(null);
  return <StockSearch value={stock} onChange={setStock} />;
}

beforeEach(() => search.hook.mockReturnValue({ data: { results: options }, isLoading: false, isError: false, refetch: search.refetch }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("StockSearch keyboard and request states", () => {
  it("retains input focus while navigating and selecting the named listbox options", async () => {
    render(<Form />);
    const input = screen.getByRole("combobox", { name: "Stock" }) as HTMLInputElement;
    input.focus();
    fireEvent.change(input, { target: { value: "TCS" } });
    await screen.findAllByRole("option");
    expect(input.getAttribute("aria-controls")).toBe(screen.getByRole("listbox").id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    let active = screen.getAllByRole("option")[0];
    expect(input.getAttribute("aria-activedescendant")).toBe(active.id);
    expect(active.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    active = screen.getAllByRole("option")[1];
    expect(input.getAttribute("aria-activedescendant")).toBe(active.id);
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("TCS.BO");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it("closes with Escape without selecting or erasing the typed query", async () => {
    render(<Form />);
    const input = screen.getByRole("combobox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "TCS" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.value).toBe("TCS");
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("distinguishes loading, no matches and failure with a retry", async () => {
    search.hook.mockReturnValue({ isLoading: true, isError: false, refetch: search.refetch });
    const { rerender } = render(<Form />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "TCS" } });
    expect(screen.getByRole("status").textContent).toContain("Searching stocks");
    expect(screen.queryByRole("option")).toBeNull();

    search.hook.mockReturnValue({ data: { results: [] }, isLoading: false, isError: false, refetch: search.refetch });
    rerender(<Form />);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("No stocks found"));
    search.hook.mockReturnValue({ isLoading: false, isError: true, refetch: search.refetch });
    rerender(<Form />);
    expect(screen.getByRole("status").textContent).toContain("unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry stock search" }));
    expect(search.refetch).toHaveBeenCalledOnce();
  });
});
