import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditEventSchema, formatIssues } from "@/lib/server/validation";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  try {
    // audit_log is append-only (migration 009) -- rows written here can never
    // be deleted, by anyone, so an unthrottled writer has no remediation path.
    const limit = await rateLimit("audit", request, 30, 60);
    if (!limit.ok) {
      return tooManyRequests(60);
    }

    const parsed = auditEventSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatIssues(parsed.error) },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const userAgent = request.headers.get("user-agent");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? null;

    const { error } = await supabase.from("audit_log").insert({
      user_id: user.id,
      action_type: body.action_type,
      entity_type: body.entity_type,
      entity_id: body.entity_id ?? null,
      old_values: body.old_values ?? null,
      new_values: body.new_values ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Audit log API error:", error);
    return NextResponse.json(
      { error: "Failed to write audit log" },
      { status: 500 }
    );
  }
}
