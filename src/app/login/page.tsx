"use client";

import { FormEvent, useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const router = useRouter();

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");
    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    if (data) {
      setSuccessMessage("Login successful. Redirecting...");
      setIsLoading(false);

      setTimeout(() => {
        router.push("/");
      }, 1200);
    }
  }

  async function handleGoogleLogin() {
    setSuccessMessage("");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/`
            : undefined,
      },
    });

    if (error) {
      setErrorMessage(error.message);
    }
  }

  async function handleAppleLogin() {
    setSuccessMessage("");
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/`
            : undefined,
      },
    });

    if (error) {
      setErrorMessage(error.message);
    }
  }

  return (
    <div className="flex min-h-screen overflow-hidden bg-black font-sans text-white">
      {/* Left Side - Login Form */}
      <div className="flex w-full flex-col justify-center px-8 py-12 sm:px-16 lg:w-[42%] lg:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Heading */}
          <div className="mb-12">
            <h1 className="text-[48px] font-bold leading-[1.05] tracking-tight text-white">
              Rise above.
            </h1>
            <h1 className="text-[48px] font-bold leading-[1.05] tracking-tight">
              <span className="text-cyan-400">Trade</span>{" "}
              <span className="text-[#22c55e]">beyond.</span>
            </h1>
            <p className="mt-6 text-[18px] font-medium leading-relaxed text-gray-400">
              Intelligent insights. Real-time edge.
              <br />
              Built for traders who aim higher.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Input */}
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
                <Mail className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="block w-full rounded-xl border border-gray-800 bg-transparent py-[19px] pl-14 pr-4 text-[16px] text-white placeholder:text-gray-600 transition-all focus:border-gray-600 focus:outline-none"
                required
              />
            </div>

            {/* Password Input */}
            <div className="group relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="block w-full rounded-xl border border-gray-800 bg-transparent py-[19px] pl-14 pr-14 text-[16px] text-white placeholder:text-gray-600 transition-all focus:border-gray-600 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-5 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between py-3 text-[14px]">
              <label className="group flex cursor-pointer items-center gap-2">
                <div className="relative flex h-5 w-5 items-center justify-center rounded border border-gray-700 bg-transparent transition-colors group-hover:border-gray-500">
                  <input
                    type="checkbox"
                    className="peer absolute h-full w-full cursor-pointer opacity-0"
                    defaultChecked
                  />
                  <svg
                    className="h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <span className="text-gray-300">Remember me</span>
              </label>

              <Link
                href="#"
                className="text-gray-300 transition-colors hover:text-white"
              >
                Forgot password?
              </Link>
            </div>

            {successMessage ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-400">
                {successMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400">
                {errorMessage}
              </p>
            ) : null}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-4 w-full rounded-xl border border-gray-800 bg-transparent py-[18px] text-[16px] font-bold text-white transition-all hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>

            {/* Divider */}
            <div className="relative flex items-center py-8">
              <div className="flex-grow border-t border-gray-900"></div>
              <span className="mx-6 flex-shrink text-sm font-medium text-gray-600">
                or
              </span>
              <div className="flex-grow border-t border-gray-900"></div>
            </div>

            {/* Social Buttons */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex w-full items-center rounded-xl border border-gray-800 bg-transparent px-6 py-[18px] transition-all hover:border-gray-700"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="flex-1 text-center text-[15px] font-bold text-gray-300">
                  Continue with Google
                </span>
              </button>

              <button
                type="button"
                onClick={handleAppleLogin}
                className="flex w-full items-center rounded-xl border border-gray-800 bg-transparent px-6 py-[18px] transition-all hover:border-gray-700"
              >
                <svg className="h-6 w-6 fill-white" viewBox="0 0 384 512">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-1.7-111.1zM271 81.1c21.6-27.1 16.9-64.7 16.9-64.7s-34.1 1.5-57.3 28.5c-20.8 24.2-16.1 59.4-16.1 59.4s33.9 4.1 56.5-23.2z" />
                </svg>
                <span className="flex-1 text-center text-[15px] font-bold text-gray-300">
                  Continue with Apple
                </span>
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-14 text-center">
            <p className="text-[15px] font-medium text-gray-500">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="ml-1 font-bold text-[#22c55e] transition-colors hover:text-[#4ade80]"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Hero Section with Actual Logo */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-black lg:flex">
        {/* SVG Fading Rings */}
        <svg
          className="absolute"
          width="720"
          height="720"
          viewBox="0 0 720 720"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="outerRingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(34,211,238,0.5)" />
              <stop offset="40%" stopColor="rgba(34,211,238,0.35)" />
              <stop offset="70%" stopColor="rgba(34,211,238,0.08)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </linearGradient>

            <filter id="outerGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <linearGradient id="innerRingGrad" x1="1" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="rgba(34,197,94,0.45)" />
              <stop offset="35%" stopColor="rgba(34,197,94,0.3)" />
              <stop offset="65%" stopColor="rgba(34,197,94,0.06)" />
              <stop offset="100%" stopColor="rgba(34,197,94,0)" />
            </linearGradient>

            <filter id="innerGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle
            cx="360"
            cy="360"
            r="349"
            stroke="url(#outerRingGrad)"
            strokeWidth="1"
            fill="none"
            filter="url(#outerGlow)"
          />
          <circle
            cx="360"
            cy="360"
            r="249"
            stroke="url(#innerRingGrad)"
            strokeWidth="1"
            fill="none"
            filter="url(#innerGlow)"
          />
        </svg>

        {/* Dark subtle background ring */}
        <div className="absolute h-[600px] w-[600px] rounded-full border border-white/[0.04]" />

        {/* Orbiting Green Dot */}
        <div className="absolute h-[500px] w-[500px] animate-[spin_30s_linear_infinite]">
          <div className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#22c55e] shadow-[0_0_20px_4px_rgba(34,197,94,0.6)]" />
        </div>

        {/* Orbiting Cyan Dot */}
        <div className="absolute h-[700px] w-[700px] animate-[spin_50s_linear_infinite_reverse]">
          <div className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_20px_4px_rgba(34,211,238,0.6)]" />
        </div>

        {/* The Actual 3D Logo Image */}
        <div className="relative z-10">
          <Image
            src="/ev-logo-new.png?v=2"
            alt="EdgeVault Logo"
            width={400}
            height={400}
            priority
          />
        </div>
      </div>
    </div>
  );
}
