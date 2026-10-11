// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USER_PREFERENCES, useAppStore } from "@/lib/stores/app-store";
import { Header } from "./Header";

const mock = vi.hoisted(() => ({
  push: vi.fn(), refresh: vi.fn(), signOut: vi.fn(), markRead: vi.fn(), refetch: vi.fn(),
  notifications: { isError: false, isLoading: false, unread: 1, rows: [] as unknown[] },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mock.push, refresh: mock.refresh }) }));
vi.mock("@/lib/client/audit", () => ({ logAuditEvent: async () => undefined }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut: mock.signOut } }) }));
vi.mock("@/lib/hooks/use-news-feed", () => ({ useNewsFeed: () => ({ data: { articles: [] }, isPending: false }) }));
vi.mock("@/lib/hooks/use-notifications", () => ({
  useNotifications: () => ({ ...mock.notifications, markAllRead: { mutate: mock.markRead }, refetch: mock.refetch }),
}));

describe("header keyboard and account feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.signOut.mockResolvedValue({ error: null });
    mock.notifications.isError = false;
    useAppStore.setState({ mobileSidebarOpen: false, user: {
      id: "alice", username: "alice", full_name: "Alice", email: "alice@example.test",
      role: "user", avatar_url: null, preferences: DEFAULT_USER_PREFERENCES,
    } });
  });
  afterEach(() => { cleanup(); useAppStore.setState({ user: null, mobileSidebarOpen: false }); });

  it("opens the account menu at either end, supports arrows and restores focus on Escape", () => {
    render(<Header />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const profile = screen.getByRole("menuitem", { name: "Profile" });
    expect(document.activeElement).toBe(profile);
    fireEvent.keyDown(profile, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Settings" }));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Sign out" }));
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Sign out" }));
  });

  it("dismisses account menus on Tab and outside pointer clicks", () => {
    render(<Header />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Profile" }), { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens only one popover, marks notifications once and restores the bell on Escape", () => {
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const bell = screen.getByRole("button", { name: "Notifications" });
    fireEvent.click(bell);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Notifications" }));
    expect(mock.markRead).toHaveBeenCalledOnce();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(bell);
  });

  it("exposes failed notification loading and a retry action", () => {
    mock.notifications.isError = true;
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByRole("alert").textContent).toContain("Could not load notifications");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mock.refetch).toHaveBeenCalledOnce();
  });

  it("keeps the signed-in profile after a failed logout and allows retry", async () => {
    mock.signOut.mockResolvedValueOnce({ error: new Error("provider unavailable") });
    render(<Header />);
    fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(useAppStore.getState().user?.id).toBe("alice");
    expect(mock.push).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" })); });
    await waitFor(() => expect(mock.push).toHaveBeenCalledWith("/login"));
    expect(useAppStore.getState().user).toBeNull();
  });

  it("toggles the shared mobile navigation state through a labelled control", () => {
    render(<Header />);
    const toggle = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(toggle);
    expect(useAppStore.getState().mobileSidebarOpen).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});
