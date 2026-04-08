import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ML_BACKEND_URL =
  process.env.NEXT_PUBLIC_ML_BACKEND_URL || "http://localhost:8000";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [{ data: users }, { data: audit }, { count: predictionCount }] =
      await Promise.all([
        supabase
          .from("users")
          .select("id, username, email, role, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("audit_log")
          .select("id, user_id, action_type, entity_type, entity_id, old_values, new_values, ip_address, user_agent, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("prediction_history")
          .select("id", { count: "exact", head: true }),
      ]);

    let mlHealth: { status: string; uptime?: number; models_loaded?: Record<string, boolean> } | null = null;
    try {
      const response = await fetch(`${ML_BACKEND_URL}/health`, {
        cache: "no-store",
      });
      if (response.ok) {
        mlHealth = (await response.json()) as typeof mlHealth;
      }
    } catch {
      mlHealth = null;
    }

    return NextResponse.json({
      userCount: users?.length ?? 0,
      adminCount: users?.filter((row) => row.role === "admin").length ?? 0,
      predictionCount: predictionCount ?? 0,
      recentUsers: users ?? [],
      recentAudit: audit ?? [],
      mlHealth,
    });
  } catch (error) {
    console.error("Admin overview route error:", error);
    return NextResponse.json(
      { error: "Failed to load admin overview" },
      { status: 500 }
    );
  }
}
