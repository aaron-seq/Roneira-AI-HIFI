import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface AuditRequestBody {
  action_type?: string;
  entity_type?: string;
  entity_id?: string | null;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AuditRequestBody;

    if (!body.action_type || !body.entity_type) {
      return NextResponse.json(
        { error: "action_type and entity_type are required" },
        { status: 400 }
      );
    }

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
