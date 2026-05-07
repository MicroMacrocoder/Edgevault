"use client";

import Link from "next/link";

export default function ConnectPlatformPage() {
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
              Connect Platform
            </h1>

            <p className="mt-3 text-sm text-gray-700 md:text-base">
              Choose the trading platform you want to connect to your trading
              journal.
            </p>
          </section>

          <section className="mt-8 grid gap-6 md:grid-cols-2">
            <Link
              href="/connect-platform/metatrader"
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition hover:border-black hover:shadow-md"
            >
              <h2 className="text-2xl font-semibold text-gray-900">
                MetaTrader
              </h2>

              <p className="mt-3 text-sm text-gray-700">
                Connect MT4 or MT5 accounts for automated trade logging and
                syncing.
              </p>

              <p className="mt-5 text-sm font-semibold text-blue-700">
                Choose MT4 / MT5 →
              </p>
            </Link>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 opacity-70 shadow-sm">
              <h2 className="text-2xl font-semibold text-gray-900">
                Other Platforms
              </h2>

              <p className="mt-3 text-sm text-gray-700">
                More platform connections will be added later.
              </p>

              <p className="mt-5 text-sm font-semibold text-gray-500">
                Coming soon
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
