import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ResponseCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

interface LoginRequestBody {
  username?: string;
  password?: string;
}

function normalizeUsername(input: string | null) {
  return input?.trim().toLowerCase() ?? "";
}

export async function GET(request: NextRequest) {
  try {
    const username = normalizeUsername(
      new URL(request.url).searchParams.get("username")
    );

    if (username.length < 3) {
      return NextResponse.json(
        { error: "username must be at least 3 characters" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return NextResponse.json({ available: data === null });
  } catch (error) {
    console.error("Username availability error:", error);
    return NextResponse.json(
      { error: "Failed to check username availability" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginRequestBody;
    const username = normalizeUsername(body.username ?? null);
    const password = body.password?.trim() ?? "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "username and password are required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("id, email")
      .eq("username", username)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile?.email) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const responseCookies: ResponseCookie[] = [];
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: ResponseCookie[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              responseCookies.push({ name, value, options });
            });
          },
        },
      }
    );

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (authError) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    await admin.from("audit_log").insert({
      user_id: profile.id,
      action_type: "LOGIN",
      entity_type: "auth",
      new_values: {
        username,
      },
      ip_address:
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: request.headers.get("user-agent"),
    });

    const response = NextResponse.json({ ok: true });
    responseCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });
    return response;
  } catch (error) {
    console.error("Username login error:", error);
    return NextResponse.json(
      { error: "Failed to sign in" },
      { status: 500 }
    );
  }
}
