"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Bell,
  Moon,
  Sun,
  LogOut,
  Settings,
  User,
  Command,
} from "lucide-react";
import { logAuditEvent } from "@/lib/client/audit";
import { useNewsFeed } from "@/lib/hooks/use-news-feed";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useAppStore } from "@/lib/stores/app-store";
import { createClient } from "@/lib/supabase/client";

export function Header() {
  const router = useRouter();
  const {
    user,
    theme,
    toggleTheme,
    sidebarCollapsed,
    setCommandPaletteOpen,
    setUser,
  } = useAppStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  // The bell is for things that happened to the user (fired alerts), not a
  // replay of their own clicks -- that is what the Audit Log page is for.
  const notifications = useNotifications();
  const unreadNotifications = notifications.unread;
  const preferredMarket =
    user?.preferences.defaultMarket === "NSE" ||
    user?.preferences.defaultMarket === "BSE"
      ? "india"
      : "global";
  const headlinesQuery = useNewsFeed(preferredMarket, "stock market");
  const headlines = (headlinesQuery.data?.articles ?? [])
    .slice(0, 6)
    .map((article) => `${article.source}: ${article.title}`);
  const tickerItems =
    headlines.length > 0
      ? [...headlines, ...headlines]
      : [
          // A successful fetch with zero articles (no NEWS_API_KEY, or a quiet
          // feed) used to fall through to "Loading..." and stay there.
          headlinesQuery.isPending
            ? "Loading live market headlines..."
            : "Live market headlines are unavailable right now.",
        ];

  // Cmd/Ctrl+K is bound inside CommandPalette, which toggles the same store
  // value. Binding it here too made the two handlers race on one keypress.

  useEffect(() => {
    if (!showUserMenu && !showNotifications) {
      return;
    }

    function handleClick() {
      setShowUserMenu(false);
      setShowNotifications(false);
    }

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [showUserMenu, showNotifications]);

  async function handleLogout() {
    await logAuditEvent({
      actionType: "LOGOUT",
      entityType: "auth",
      newValues: {
        at: new Date().toISOString(),
      },
    }).catch(() => undefined);

    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  function openSettings() {
    setShowUserMenu(false);
    router.push("/dashboard/settings");
  }

  return (
    <header
      className="fixed right-0 top-0 z-30 flex h-16 items-center border-b transition-all duration-300"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        left: sidebarCollapsed
          ? "var(--spacing-sidebar-collapsed)"
          : "var(--spacing-sidebar)",
      }}
    >
      {/* No "Intelligent Financial Advisor" label: the sidebar already
          carries the brand, and an unregistered tool calling itself a
          financial advisor is a regulatory claim this product cannot make. */}
      <div className="px-2" />

      <div className="flex-1 overflow-hidden px-4">
        <div
          className="relative overflow-hidden rounded-md"
          style={{ background: "var(--color-bg)" }}
        >
          <div className="animate-scroll-left flex whitespace-nowrap py-1.5 hover:[animation-play-state:paused]">
            {tickerItems.map((headline, index) => (
              <span
                key={`${headline}-${index}`}
                className="mx-6 inline-block text-xs"
                style={{ color: "var(--color-text-muted)" }}
              >
                {headline}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 px-4">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Search pages and actions (Ctrl+K)"
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Search className="h-4 w-4" />
          <span className="hidden md:inline">Search</span>
          <kbd
            className="hidden rounded px-1.5 py-0.5 text-[10px] font-medium md:inline"
            style={{
              background: "var(--color-surface-offset)",
              color: "var(--color-text-faint)",
              border: "1px solid var(--color-border)",
            }}
          >
            <Command className="mr-0.5 inline h-2.5 w-2.5" />
            K
          </kbd>
        </button>

        <div className="relative">
          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowUserMenu(false);
              setShowNotifications((open) => {
                if (!open && notifications.unread > 0) {
                  notifications.markAllRead.mutate();
                }
                return !open;
              });
            }}
            className="relative rounded-lg p-2 transition-colors hover:bg-white/5"
            aria-label="Notifications"
          >
            <Bell
              className="h-4 w-4"
              style={{ color: "var(--color-text-muted)" }}
            />
            {unreadNotifications > 0 && (
              <span
                className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ background: "#E74C3C" }}
              >
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              className="absolute right-0 top-12 z-50 w-72 rounded-xl border py-1 shadow-xl"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className="border-b px-3 py-2 text-sm font-medium"
                style={{
                  borderColor: "var(--color-divider)",
                  color: "var(--color-text-primary)",
                }}
              >
                Notifications
              </div>
              {notifications.isLoading ? (
                <p
                  className="px-3 py-3 text-xs"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  Loading...
                </p>
              ) : notifications.rows.length === 0 ? (
                <p
                  className="px-3 py-3 text-xs"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  No alerts yet. Set a price alert on any Watchlist row; it is
                  checked after each market close.
                </p>
              ) : (
                <ul className="max-h-72 overflow-y-auto">
                  {notifications.rows.map((row) => (
                    <li
                      key={row.id}
                      className="px-3 py-2 text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      <p
                        style={{
                          color: "var(--color-text-primary)",
                          fontWeight: row.read_at ? 400 : 600,
                        }}
                      >
                        {row.title}
                      </p>
                      {row.body && <p>{row.body}</p>}
                      <p style={{ color: "var(--color-text-faint)" }}>
                        {new Date(row.created_at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => {
                  setShowNotifications(false);
                  router.push("/dashboard/audit-log");
                }}
                className="w-full border-t px-3 py-2 text-left text-xs transition-colors hover:bg-white/5"
                style={{ borderColor: "var(--color-divider)", color: "var(--color-text-faint)" }}
              >
                View your activity log
              </button>
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 transition-colors hover:bg-white/5"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          ) : (
            <Moon className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
          )}
        </button>

        <div className="relative">
          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowUserMenu(!showUserMenu);
            }}
            aria-label="Account menu"
            aria-expanded={showUserMenu}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold"
              style={{
                background: "var(--color-surface-offset)",
                borderColor: "var(--color-border)",
                color: "var(--color-text-primary)",
              }}
            >
              {(user?.full_name || user?.username || "U")[0]?.toUpperCase()}
            </div>
            {user && (
              <span
                className="hidden text-sm font-medium md:inline"
                style={{ color: "var(--color-text-primary)" }}
              >
                {user.full_name || user.username}
              </span>
            )}
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 top-12 z-50 w-48 rounded-xl border py-1 shadow-xl"
              style={{
                background: "var(--color-surface-2)",
                borderColor: "var(--color-border)",
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div
                className="border-b px-3 py-2"
                style={{ borderColor: "var(--color-divider)" }}
              >
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {user?.full_name || "Signed in user"}
                </p>
                <p
                  className="text-xs"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  {user ? `@${user.username}` : "No active profile"}
                </p>
              </div>
              <button
                onClick={openSettings}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5"
                style={{ color: "var(--color-text-muted)" }}
              >
                <User className="h-4 w-4" /> Profile
              </button>
              <button
                onClick={openSettings}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5"
                style={{ color: "var(--color-text-muted)" }}
              >
                <Settings className="h-4 w-4" /> Settings
              </button>
              <div
                className="border-t"
                style={{ borderColor: "var(--color-divider)" }}
              />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-white/5"
                style={{ color: "#E74C3C" }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
