"use client";

import Link from "next/link";

export default function MetaTraderPage() {
  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/saved-trade-logs"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            Saved Trade Logs
          </Link>

          <Link
            href="/trade-log"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            Trade Log Builder
          </Link>

          <Link
            href="/journal"
            className="cursor-pointer text-sm font-medium text-gray-800 hover:text-black"
          >
            Journal
          </Link>
        </div>
      </nav>

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h1 className="app-page-title text-3xl md:text-4xl">
              MetaTrader
            </h1>

            <p className="mt-3 text-sm text-gray-700 md:text-base">
              Choose the MetaTrader version you want to connect to your trading journal.
            </p>
          </section>

          <section className="mt-8 grid gap-6 md:grid-cols-2">
            {/* MT5 */}
            <Link
              href="/connect-platform/metatrader/mt5"
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-black hover:shadow-md"
            >
              <h2 className="text-2xl font-semibold text-gray-900">
                MetaTrader 5 (MT5)
              </h2>

              <p className="mt-3 text-sm text-gray-700">
                Connect your MT5 account for automatic trade logging, live trade syncing,
                and performance tracking.
              </p>

              <p className="mt-5 text-sm font-semibold text-blue-700">
                Connect MT5 →
              </p>
            </Link>

            {/* MT4 */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 opacity-70 shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-900">
                MetaTrader 4 (MT4)
              </h2>

              <p className="mt-3 text-sm text-gray-700">
                MT4 connector will be supported later.
              </p>

              <p className="mt-5 text-sm font-semibold text-gray-500">
                Coming soon
              </p>
            </div>
          </section>

          <div className="mt-8">
            <Link
              href="/connect-platform"
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              ← Back to Platform Selection
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
