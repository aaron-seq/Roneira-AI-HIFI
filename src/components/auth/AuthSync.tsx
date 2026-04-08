"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
  type NotificationPreferences,
  type UserPreferences,
  type UserProfile,
  useAppStore,
} from "@/lib/stores/app-store";

function toNotificationPreferences(
  value: unknown
): NotificationPreferences {
  const input =
    typeof value === "object" && value !== null
      ? (value as Partial<NotificationPreferences>)
      : {};

  return {
    priceAlerts:
      typeof input.priceAlerts === "boolean"
        ? input.priceAlerts
        : DEFAULT_NOTIFICATION_PREFERENCES.priceAlerts,
    predictionComplete:
      typeof input.predictionComplete === "boolean"
        ? input.predictionComplete
        : DEFAULT_NOTIFICATION_PREFERENCES.predictionComplete,
    newsSentiment:
      typeof input.newsSentiment === "boolean"
        ? input.newsSentiment
        : DEFAULT_NOTIFICATION_PREFERENCES.newsSentiment,
    weeklyReport:
      typeof input.weeklyReport === "boolean"
        ? input.weeklyReport
        : DEFAULT_NOTIFICATION_PREFERENCES.weeklyReport,
  };
}

function toUserPreferences(value: unknown): UserPreferences {
  const input =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const theme = input.theme === "light" ? "light" : "dark";
  const defaultMarket =
    input.defaultMarket === "BSE" ||
    input.defaultMarket === "NASDAQ" ||
    input.defaultMarket === "NYSE" ||
    input.defaultMarket === "NSE"
      ? input.defaultMarket
      : DEFAULT_USER_PREFERENCES.defaultMarket;
  const newsFeed = Array.isArray(input.newsFeed)
    ? input.newsFeed.filter((entry): entry is string => typeof entry === "string")
    : DEFAULT_USER_PREFERENCES.newsFeed;
  const defaultModel =
    typeof input.defaultModel === "string" && input.defaultModel.length > 0
      ? input.defaultModel
      : DEFAULT_USER_PREFERENCES.defaultModel;

  return {
    theme,
    defaultMarket,
    newsFeed,
    defaultModel,
    notifications: toNotificationPreferences(input.notifications),
  };
}

async function fetchUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, username, full_name, email, role, avatar_url, preferences")
    .eq("id", user.id)
    .maybeSingle();

  const preferences = toUserPreferences(profile?.preferences ?? user.user_metadata);

  return {
    id: user.id,
    username:
      (profile?.username as string | undefined) ||
      String(user.user_metadata.username || user.email?.split("@")[0] || "user"),
    full_name:
      (profile?.full_name as string | undefined) ||
      String(user.user_metadata.full_name || ""),
    email: (profile?.email as string | undefined) || user.email || "",
    role: profile?.role === "admin" ? "admin" : "user",
    avatar_url: (profile?.avatar_url as string | null | undefined) ?? null,
    preferences,
  };
}

export function AuthSync() {
  const setTheme = useAppStore((state) => state.setTheme);
  const setUser = useAppStore((state) => state.setUser);

  useEffect(() => {
    const supabase = createClient();

    async function hydrateUser() {
      const profile = await fetchUserProfile();
      setUser(profile);
      if (profile) {
        setTheme(profile.preferences.theme);
      }
    }

    void hydrateUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void hydrateUser();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setTheme, setUser]);

  return null;
}
