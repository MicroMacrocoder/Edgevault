"use client";

import Link from "next/link";

export default function Mt5SetupPage() {
  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/connect-platform"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            Connect Platform
          </Link>

          <Link
            href="/connect-platform/metatrader"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            MetaTrader
          </Link>

          <Link
            href="/connect-platform/metatrader/mt5"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            MT5
          </Link>
        </div>
      </nav>

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h1 className="app-page-title text-3xl md:text-4xl">
              MT5 Setup
            </h1>

            <p className="mt-3 text-sm text-gray-700 md:text-base">
              This is the setup page for connecting your desktop MT5 terminal to
              your trading journal.
            </p>

            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">What this page is for</p>

              <p className="mt-2 text-sm text-blue-800">
                This page is where the real MT5 connection flow will begin. For
                now, it helps us structure the setup process before the actual
                Python connector is added.
              </p>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">System Requirements</h2>

            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ A Windows laptop or desktop
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ MetaTrader 5 installed on that computer
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ Logged into your MT5 trading account
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ Your trading journal account
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ⏳ Python connector setup will be added in the next phase
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">Choose Your Setup Path</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                className="cursor-pointer rounded-xl border border-gray-200 bg-gray-50 p-5 text-left transition hover:border-gray-400 hover:bg-white hover:shadow-sm"
              >
                <p className="text-sm font-semibold text-gray-900">
                  Guide Me Step by Step
                </p>

                <p className="mt-2 text-sm text-gray-700">
                  Use the guided setup flow when the Python connector stage is
                  ready.
                </p>
              </button>

              <button
                type="button"
                className="cursor-pointer rounded-xl border border-gray-200 bg-gray-50 p-5 text-left transition hover:border-gray-400 hover:bg-white hover:shadow-sm"
              >
                <p className="text-sm font-semibold text-gray-900">
                  I Already Have MT5 Ready
                </p>

                <p className="mt-2 text-sm text-gray-700">
                  Use the faster route later if your MT5 terminal and local
                  setup are already prepared.
                </p>
              </button>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">Connection Status</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-xs font-medium uppercase text-gray-600">
                  MT5 Terminal
                </p>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  Not checked yet
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-xs font-medium uppercase text-gray-600">
                  Python Connector
                </p>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  Not connected yet
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-xs font-medium uppercase text-gray-600">
                  Sync Status
                </p>
                <p className="mt-2 text-sm font-semibold text-gray-900">
                  Setup not completed
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">Next Actions</h2>

            <p className="mt-2 text-sm text-gray-700">
              This page is ready for the next stage of the MT5 integration.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="cursor-not-allowed rounded-lg bg-gray-300 px-5 py-3 text-sm font-medium text-gray-600"
              >
                Continue Setup Coming Soon
              </button>

              <Link
                href="/connect-platform/metatrader/mt5"
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Back to MT5
              </Link>

              <Link
                href="/connect-platform/metatrader"
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Back to MetaTrader
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
