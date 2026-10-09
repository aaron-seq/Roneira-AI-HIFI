import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function Home() {
  if (!isSupabaseConfigured) {
    return <LandingPage />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard/market-overview");
  }

  return <LandingPage />;
}
