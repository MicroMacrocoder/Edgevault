"use client";

import Link from "next/link";

export default function ConnectMt4Page() {
  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/connect-platform"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Connect Platform
          </Link>

          <Link
            href="/connect-platform/metatrader"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            MetaTrader
          </Link>

          <Link
            href="/saved-trade-logs"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Saved Trade Logs
          </Link>
        </div>
      </nav>

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h1 className="app-page-title text-3xl md:text-4xl">
              Connect MT4
            </h1>

            <p className="mt-3 text-sm text-gray-700 md:text-base">
              Connect your desktop MT4 terminal to your trading journal.
            </p>

            <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-medium text-orange-900">
                MT4 support is planned
              </p>

              <p className="mt-2 text-sm text-orange-800">
                MT4 uses a different connection method from MT5, so its setup
                flow will be added separately.
              </p>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">What to expect later</h2>

            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ MT4 connection guide
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ MT4 terminal linking flow
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ Trade sync into your trade log
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="cursor-not-allowed rounded-lg bg-gray-300 px-5 py-3 text-sm font-medium text-gray-600"
              >
                MT4 Setup Coming Soon
              </button>

              <Link
                href="/connect-platform/metatrader"
                className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
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
