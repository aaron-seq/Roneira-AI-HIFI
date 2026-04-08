"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  User,
  Bell,
  Globe,
  Palette,
  Shield,
  Key,
  Moon,
  Sun,
  Save,
  LogOut,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { logAuditEvent } from "@/lib/client/audit";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type UserProfile,
  type UserPreferences,
  useAppStore,
} from "@/lib/stores/app-store";
import { cn } from "@/lib/utils";

const notificationItems: Array<{
  key: keyof NotificationPreferences;
  label: string;
  desc: string;
}> = [
  {
    key: "priceAlerts",
    label: "Price Alerts",
    desc: "Get notified when a stock hits your target price",
  },
  {
    key: "predictionComplete",
    label: "Prediction Complete",
    desc: "Notification when ML analysis finishes",
  },
  {
    key: "newsSentiment",
    label: "News Sentiment Alerts",
    desc: "Alert when bearish sentiment is detected",
  },
  {
    key: "weeklyReport",
    label: "Weekly Portfolio Report",
    desc: "Receive a weekly P&L summary email",
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, setTheme: applyTheme } = useAppStore();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [defaultMarket, setDefaultMarket] =
    useState<UserPreferences["defaultMarket"]>("NSE");
  const [defaultModel, setDefaultModel] = useState("ENSEMBLE");
  const [notifications, setNotifications] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    setFullName(user.full_name ?? "");
    setUsername(user.username ?? "");
    setEmail(user.email ?? "");
    setTheme(user.preferences.theme);
    setDefaultMarket(user.preferences.defaultMarket);
    setDefaultModel(user.preferences.defaultModel);
    setNotifications(
      user.preferences.notifications ?? DEFAULT_NOTIFICATION_PREFERENCES
    );
  }, [user]);

  async function handleSave() {
    if (!user) {
      setStatus({
        tone: "error",
        message: "Sign in again to update your settings.",
      });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      const trimmedUsername = username.trim().toLowerCase();
      const trimmedFullName = fullName.trim();

      if (trimmedUsername.length < 3) {
        throw new Error("Username must be at least 3 characters.");
      }

      if (trimmedUsername !== user.username) {
        const availabilityResponse = await fetch(
          `/api/auth/username?username=${encodeURIComponent(trimmedUsername)}`
        );
        const availabilityPayload = (await availabilityResponse.json()) as {
          available?: boolean;
        };

        if (!availabilityResponse.ok || !availabilityPayload.available) {
          throw new Error("That username is already in use.");
        }
      }

      const nextPreferences = {
        ...user.preferences,
        theme,
        defaultMarket,
        defaultModel,
        notifications,
      };

      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .update({
          username: trimmedUsername,
          full_name: trimmedFullName,
          preferences: nextPreferences,
        })
        .eq("id", user.id)
        .select("id, username, full_name, email, role, avatar_url, preferences")
        .single();

      if (error) {
        throw error;
      }

      const updatedUser: UserProfile = {
        id: data.id,
        username: data.username,
        full_name: data.full_name ?? "",
        email: data.email ?? user.email,
        role: data.role === "admin" ? "admin" : "user",
        avatar_url: data.avatar_url ?? null,
        preferences: nextPreferences,
      };

      setUser(updatedUser);
      applyTheme(theme);

      await logAuditEvent({
        actionType: "SETTINGS_CHANGE",
        entityType: "settings",
        oldValues: {
          username: user.username,
          full_name: user.full_name,
          preferences: user.preferences,
        },
        newValues: {
          username: updatedUser.username,
          full_name: updatedUser.full_name,
          preferences: nextPreferences,
        },
      }).catch(() => undefined);

      setStatus({
        tone: "success",
        message: "Your settings were saved.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not save your settings.",
      });
    } finally {
      setSaving(false);
    }
  }

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

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="card p-6">
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            Settings
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Your session could not be loaded. Please sign in again to manage
            account settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--color-text-primary)" }}
        >
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
          Manage your account preferences and platform configuration
        </p>
      </div>

      <div className="space-y-6">
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4" style={{ color: "var(--color-info)" }} />
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Profile
            </h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                    )
                  }
                  className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1.5 block text-xs font-medium"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  readOnly
                  className="w-full rounded-lg px-4 py-2.5 text-sm outline-none opacity-70"
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                />
              </div>
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                Display Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Palette className="h-4 w-4" style={{ color: "var(--color-warning)" }} />
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Appearance
            </h3>
          </div>
          <div className="flex gap-3">
            {(["dark", "light"] as const).map((option) => {
              const icons = { dark: Moon, light: Sun };
              const Icon = icons[option];
              return (
                <button
                  key={option}
                  onClick={() => setTheme(option)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium capitalize transition-all"
                  )}
                  style={{
                    background:
                      theme === option
                        ? "var(--color-surface-offset)"
                        : "var(--color-surface)",
                    border: `1px solid ${
                      theme === option ? "var(--color-info)" : "var(--color-border)"
                    }`,
                    color:
                      theme === option
                        ? "var(--color-text-primary)"
                        : "var(--color-text-faint)",
                  }}
                >
                  <Icon className="h-4 w-4" /> {option}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4" style={{ color: "var(--color-teal)" }} />
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Trading Preferences
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                Default Market
              </label>
              <select
                value={defaultMarket}
                onChange={(event) =>
                  setDefaultMarket(
                    event.target.value as UserPreferences["defaultMarket"]
                  )
                }
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              >
                <option value="NSE">NSE (India)</option>
                <option value="BSE">BSE (India)</option>
                <option value="NASDAQ">NASDAQ (US)</option>
                <option value="NYSE">NYSE (US)</option>
              </select>
            </div>
            <div>
              <label
                className="mb-1.5 block text-xs font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                Default ML Model
              </label>
              <select
                value={defaultModel}
                onChange={(event) => setDefaultModel(event.target.value)}
                className="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-primary)",
                }}
              >
                <option value="ENSEMBLE">Ensemble (Auto)</option>
                <option value="LSTM">LSTM</option>
                <option value="RANDOM_FOREST">Random Forest</option>
                <option value="GAN">GAN</option>
                <option value="TECHNICAL">Technical Analysis</option>
                <option value="PVD_MOMENTUM">PVD Momentum</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4" style={{ color: "var(--color-ai-purple)" }} />
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Notifications
            </h3>
          </div>
          <div className="space-y-3">
            {notificationItems.map((notification) => (
              <div
                key={notification.key}
                className="flex items-center justify-between rounded-lg px-4 py-3"
                style={{ background: "var(--color-surface)" }}
              >
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {notification.label}
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {notification.desc}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setNotifications((current) => ({
                      ...current,
                      [notification.key]: !current[notification.key],
                    }))
                  }
                  className="relative h-5 w-9 rounded-full transition-colors"
                  style={{
                    background: notifications[notification.key]
                      ? "#2ECC71"
                      : "var(--color-surface-offset)",
                  }}
                >
                  <span
                    className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                    style={{
                      transform: notifications[notification.key]
                        ? "translateX(16px)"
                        : "translateX(0)",
                    }}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: "#E74C3C" }} />
            <h3
              className="text-sm font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              Security
            </h3>
          </div>
          <div className="space-y-3">
            <div
              className="flex w-full items-center justify-between rounded-lg px-4 py-3"
              style={{ background: "var(--color-surface)" }}
            >
              <div className="flex items-center gap-3">
                <Key className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
                <span
                  className="text-sm"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  Password changes
                </span>
              </div>
              <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                Managed through Supabase Auth
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
              style={{ background: "var(--color-surface)" }}
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-4 w-4" style={{ color: "#E74C3C" }} />
                <span className="text-sm" style={{ color: "#E74C3C" }}>
                  Sign Out
                </span>
              </div>
            </button>
          </div>
        </div>

        {status && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
            style={{
              background:
                status.tone === "success"
                  ? "rgba(46, 204, 113, 0.12)"
                  : "rgba(231, 76, 60, 0.12)",
              border:
                status.tone === "success"
                  ? "1px solid rgba(46, 204, 113, 0.2)"
                  : "1px solid rgba(231, 76, 60, 0.2)",
              color: status.tone === "success" ? "#2ECC71" : "#E74C3C",
            }}
          >
            {status.tone === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {status.message}
          </motion.div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, #3498DB, #2980B9)",
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
