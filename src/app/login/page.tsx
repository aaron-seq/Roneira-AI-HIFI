"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, User, AlertCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MarketPulse } from "@/components/auth/MarketPulse";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputClassName =
    "w-full rounded-lg py-3 text-sm outline-none transition-all duration-200 focus:border-[#3498DB] focus:shadow-[0_0_0_3px_rgba(52,152,219,0.18)]";

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/username", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error || "Invalid username or password");
        setLoading(false);
        return;
      }

      router.push("/dashboard/market-overview");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-bg)" }}>
      {/* Brand panel -- the hero here is what the product actually does
          (live market data, feeding predictions), not an illustration or a
          logo floating in a void. Hidden below lg: the form is the priority
          on a phone, not a scrolled-past hero. */}
      <div
        className="relative hidden w-[42%] flex-col justify-between overflow-hidden border-r p-12 lg:flex"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div
          className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #C8922F 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(var(--color-divider) 1px, transparent 1px), linear-gradient(90deg, var(--color-divider) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 90% 70% at 0% 0%, black 0%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 0% 0%, black 0%, transparent 75%)",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "#000000" }}>
            <Image src="/roneira-mark.png" alt="Roneira" width={20} height={20} className="h-5 w-5" priority />
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Roneira AI HIFI
          </span>
        </div>

        <div className="relative max-w-md">
          <h1
            className="text-[2.75rem] leading-[1.05]"
            style={{ fontFamily: "var(--font-instrument-serif), Georgia, serif", color: "var(--color-text-primary)" }}
          >
            Six models. One honest answer.
          </h1>
          <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            Live NSE, BSE, and global market data, portfolio tracking, and
            predictions that show you when the models disagree instead of
            hiding it behind one confident number.
          </p>
        </div>

        <div className="relative rounded-xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}>
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--color-text-faint)" }}>
            Live right now
          </p>
          <MarketPulse />
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-sm"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "#000000" }}>
              <Image src="/roneira-mark.png" alt="Roneira" width={30} height={30} className="h-[30px] w-[30px]" priority />
            </div>
            <span className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Roneira AI HIFI
            </span>
          </div>

          <h2 className="mb-1 text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Welcome back
          </h2>
          <p className="mb-8 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Sign in to your account to continue.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                Username
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--color-text-faint)" }}
                />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Enter your username"
                  required
                  autoComplete="username"
                  className={`${inputClassName} pl-10 pr-4`}
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
                htmlFor="password"
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--color-text-muted)" }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                  style={{ color: "var(--color-text-faint)" }}
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className={`${inputClassName} pl-10 pr-12`}
                  style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text-primary)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 transition-colors hover:bg-white/5"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff
                      className="h-4 w-4"
                      style={{ color: "var(--color-text-faint)" }}
                    />
                  ) : (
                    <Eye
                      className="h-4 w-4"
                      style={{ color: "var(--color-text-faint)" }}
                    />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
                style={{
                  background: "rgba(231, 76, 60, 0.1)",
                  border: "1px solid rgba(231, 76, 60, 0.2)",
                  color: "#E74C3C",
                }}
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: loading
                  ? "var(--color-surface-2)"
                  : "linear-gradient(135deg, #3498DB 0%, #2C7BB5 100%)",
              }}
              onMouseEnter={(event) => {
                if (!loading) {
                  (event.target as HTMLButtonElement).style.transform =
                    "translateY(-1px)";
                  (event.target as HTMLButtonElement).style.boxShadow =
                    "0 4px 16px rgba(52,152,219,0.28)";
                }
              }}
              onMouseLeave={(event) => {
                (event.target as HTMLButtonElement).style.transform =
                  "translateY(0)";
                (event.target as HTMLButtonElement).style.boxShadow = "none";
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-medium transition-colors hover:underline"
              style={{ color: "var(--color-info)" }}
            >
              Create one
            </Link>
          </p>

          <p className="mt-10 text-center text-xs" style={{ color: "var(--color-text-faint)" }}>
            Copyright {new Date().getFullYear()} Roneira AI HIFI. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
