"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  Mail,
  AlertCircle,
  Check,
  X,
  Activity,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const pageVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] },
  },
};

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "#E74C3C" };
  if (score <= 2) return { score, label: "Fair", color: "#E67E22" };
  if (score <= 3) return { score, label: "Good", color: "#F39C12" };
  if (score <= 4) return { score, label: "Strong", color: "#2ECC71" };
  return { score, label: "Very Strong", color: "#27AE60" };
}

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<
    boolean | null
  >(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const passwordStrength = getPasswordStrength(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  // Debounced username availability check
  const checkUsernameAvailability = useCallback(
    async (name: string) => {
      if (name.length < 3) {
        setUsernameAvailable(null);
        return;
      }
      setCheckingUsername(true);
      try {
        const response = await fetch(
          `/api/auth/username?username=${encodeURIComponent(name)}`
        );
        if (!response.ok) {
          setUsernameAvailable(null);
        } else {
          const payload = (await response.json()) as { available?: boolean };
          setUsernameAvailable(Boolean(payload.available));
        }
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (username.length >= 3) {
        checkUsernameAvailability(username);
      } else {
        setUsernameAvailable(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, checkUsernameAvailability]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (usernameAvailable === false) {
      setError("Username is already taken");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
            role: "user",
          },
          emailRedirectTo: `${window.location.origin}/dashboard/market-overview`,
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          setError("An account with this email already exists");
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      // Auto-login after signup
      router.push("/dashboard/market-overview");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text-primary)",
  };
  const inputClassName =
    "w-full rounded-lg py-2.5 text-sm outline-none transition-all duration-200 focus:border-[#3498DB] focus:shadow-[0_0_0_3px_rgba(52,152,219,0.15)]";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8" style={{ background: "var(--color-bg)" }}>
      {/* Background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #2ECC71 0%, transparent 70%)" }} />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #3498DB 0%, transparent 70%)" }} />
      </div>

      <motion.div className="relative z-10 w-full max-w-md" variants={pageVariants} initial="hidden" animate="visible">
        {/* Logo */}
        <motion.div className="mb-6 flex flex-col items-center" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg, #2ECC71 0%, #3498DB 100%)" }}>
            <Activity className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>Create your account</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>Join Roneira AI HIFI</p>
        </motion.div>

        {/* Signup Card */}
        <motion.div className="glass rounded-2xl p-8" variants={cardVariants} initial="hidden" animate="visible">
          <form onSubmit={handleSignup} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Full Name</label>
              <div className="relative">
                <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
                <input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Aaron Sequeira" required className={`${inputClassName} pl-10 pr-4`} style={inputStyle} />
              </div>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="signupUsername" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Username</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
                <input id="signupUsername" type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="Choose a username" required minLength={3} className={`${inputClassName} pl-10 pr-10`} style={inputStyle} />
                {username.length >= 3 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {checkingUsername ? (
                      <svg className="h-4 w-4 animate-spin" style={{ color: "var(--color-text-faint)" }} viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    ) : usernameAvailable ? (
                      <Check className="h-4 w-4" style={{ color: "#2ECC71" }} />
                    ) : usernameAvailable === false ? (
                      <X className="h-4 w-4" style={{ color: "#E74C3C" }} />
                    ) : null}
                  </div>
                )}
              </div>
              {usernameAvailable === false && (
                <p className="mt-1 text-xs" style={{ color: "#E74C3C" }}>Username is already taken</p>
              )}
              {usernameAvailable === true && (
                <p className="mt-1 text-xs" style={{ color: "#2ECC71" }}>Username is available</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="signupEmail" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
                <input id="signupEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className={`${inputClassName} pl-10 pr-4`} style={inputStyle} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signupPassword" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
                <input id="signupPassword" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} className={`${inputClassName} pl-10 pr-12`} style={inputStyle} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 transition-colors hover:bg-white/5" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-4 w-4" style={{ color: "var(--color-text-faint)" }} /> : <Eye className="h-4 w-4" style={{ color: "var(--color-text-faint)" }} />}
                </button>
              </div>
              {/* Password Strength */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-200" style={{ background: i <= passwordStrength.score ? passwordStrength.color : "var(--color-surface-offset)" }} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs" style={{ color: passwordStrength.color }}>{passwordStrength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--color-text-muted)" }}>Confirm Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
                <input id="confirmPassword" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" required className={`${inputClassName} pl-10 pr-10`} style={inputStyle} />
                {confirmPassword.length > 0 && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {passwordsMatch ? <Check className="h-4 w-4" style={{ color: "#2ECC71" }} /> : <X className="h-4 w-4" style={{ color: "#E74C3C" }} />}
                  </div>
                )}
              </div>
              {passwordsMismatch && <p className="mt-1 text-xs" style={{ color: "#E74C3C" }}>Passwords do not match</p>}
            </div>

            {/* Error */}
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(231, 76, 60, 0.1)", border: "1px solid rgba(231, 76, 60, 0.2)", color: "#E74C3C" }}>
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !fullName || !username || !email || !password || !confirmPassword || passwordsMismatch || usernameAvailable === false}
              className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: loading ? "var(--color-surface-2)" : "linear-gradient(135deg, #2ECC71 0%, #27AE60 100%)" }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm" style={{ color: "var(--color-text-muted)" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-medium transition-colors hover:underline" style={{ color: "#3498DB" }}>Sign in</Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
