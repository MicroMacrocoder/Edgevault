"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function SignUpPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const router = useRouter();

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");
    setIsLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsLoading(false);
      return;
    }

    if (data) {
      setSuccessMessage("Account created successfully. Redirecting to login...");
      setIsLoading(false);

      setTimeout(() => {
        router.push("/login");
      }, 1200);
    }
  }

  return (
    <main
      className="min-h-screen bg-black text-white"
      style={{ fontFamily: "'Courier Prime', monospace" }}
    >
      <nav className="flex items-center justify-between border-b border-gray-800 bg-black px-6 py-4">
        <Link href="/" className="inline-flex items-center">
          <img
            src="/edgevault-logo.png"
            alt="EdgeVault"
            className="h-10 w-auto object-contain"
          />
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/login"
            className="text-sm font-medium transition hover:text-yellow-400"
            style={{ color: "#cccccc" }}
          >
            Log In
          </Link>

          <Link
            href="/"
            className="text-sm font-medium transition hover:text-yellow-400"
            style={{ color: "#cccccc" }}
          >
            Home
          </Link>
        </div>
      </nav>

      <section className="flex items-center justify-center px-4 py-20 md:px-8">
        <div className="w-full max-w-md">
          <div
            className="border p-8 md:p-10"
            style={{
              backgroundColor: "#1a1a1a",
              borderColor: "#333333",
            }}
          >
            <h1 className="mb-2 text-4xl font-bold text-white">
              Create Account
            </h1>

            <p className="mb-8 text-sm" style={{ color: "#999999" }}>
              Create your EdgeVault account and save your trading data across
              devices.
            </p>

            <form onSubmit={handleSignUp} className="space-y-6">
              <div>
                <label className="mb-3 block text-sm font-medium text-yellow-400">
                  Email
                </label>

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 text-sm outline-none"
                  style={{
                    backgroundColor: "#0a0a0a",
                    borderColor: "#ff9800",
                    borderStyle: "dashed",
                    borderWidth: "2px",
                    color: "#ffffff",
                  }}
                  required
                />
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-yellow-400">
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 text-sm outline-none"
                  style={{
                    backgroundColor: "#0a0a0a",
                    borderColor: "#ff9800",
                    borderStyle: "dashed",
                    borderWidth: "2px",
                    color: "#ffffff",
                  }}
                  required
                />
              </div>

              {successMessage && (
                <p className="text-sm font-medium text-green-500">
                  {successMessage}
                </p>
              )}

              {errorMessage && (
                <p className="text-sm font-medium text-red-400">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-5 py-3 text-sm font-bold transition"
                style={{
                  backgroundColor: isLoading ? "#ccaa00" : "#ffeb3b",
                  color: "#000000",
                  opacity: isLoading ? 0.7 : 1,
                }}
              >
                {isLoading ? "Creating account..." : "Sign Up"}
              </button>
            </form>

            <p className="mt-8 text-sm" style={{ color: "#999999" }}>
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-cyan-400">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
