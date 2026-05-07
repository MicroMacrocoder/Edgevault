"use client";

import Link from "next/link";

export default function ConnectMt5Page() {
  return (
    <main className="min-h-screen bg-gray-100">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/saved-trade-logs"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Saved Trade Logs
          </Link>

          <Link
            href="/trade-log"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Trade Log Builder
          </Link>

          <Link
            href="/journal"
            className="text-sm font-medium text-gray-800 hover:text-black"
          >
            Journal
          </Link>
        </div>
      </nav>

      <div className="px-4 py-8 md:px-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h1 className="app-page-title text-3xl md:text-4xl">
              Connect MT5
            </h1>

            <p className="mt-3 text-sm text-gray-700 md:text-base">
              Connect your desktop MT5 terminal to your trading journal so your
              trades can sync automatically into your trade log.
            </p>

            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">
                Important:
              </p>

              <p className="mt-2 text-sm text-blue-800">
                This works with MT5 on your laptop or desktop. Your browser
                alone cannot pull trades directly from MT5. A local connector
                will be used later to complete the sync.
              </p>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">How it works</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-sm font-semibold text-gray-900">
                  1. Open MT5 on your laptop
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  Make sure your MT5 terminal is installed and logged into the
                  trading account you want to sync.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-sm font-semibold text-gray-900">
                  2. Start the MT5 connector setup
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  The connector will later help your laptop talk to your trading
                  journal securely.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-sm font-semibold text-gray-900">
                  3. Choose your MT5 terminal
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  This can be the normal MT5 terminal or the broker-branded MT5
                  installed on your laptop.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <p className="text-sm font-semibold text-gray-900">
                  4. Sync trades automatically
                </p>
                <p className="mt-2 text-sm text-gray-700">
                  Once connected, trades taken on MT5 can be sent into your
                  trade log automatically.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">What you need</h2>

            <div className="mt-6 space-y-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ A laptop or desktop computer
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ MT5 installed on that computer
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ Logged into your MT5 trading account
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                ✅ Your trading journal account
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">Next actions</h2>

            <p className="mt-2 text-sm text-gray-700">
              For now, these buttons are placeholders for the next stage of the
              MT5 connection flow.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:opacity-90"
              >
                Start MT5 Setup
              </button>

              <button
                type="button"
                className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                I Already Installed the Connector
              </button>

              <Link
                href="/saved-trade-logs"
                className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Back to Saved Trade Logs
              </Link>
            </div>
          </section>

          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm md:p-8">
            <h2 className="app-page-title text-2xl">Troubleshooting</h2>

            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm font-semibold text-yellow-900">
                  MT5 not found?
                </p>
                <p className="mt-2 text-sm text-yellow-800">
                  Make sure MT5 is installed on your laptop and opened at least
                  once.
                </p>
              </div>

              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm font-semibold text-yellow-900">
                  Using a broker MT5?
                </p>
                <p className="mt-2 text-sm text-yellow-800">
                  That is okay. Broker-branded MT5 terminals can also be used as
                  long as they are installed on your laptop.
                </p>
              </div>

              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <p className="text-sm font-semibold text-yellow-900">
                  No automatic sync yet?
                </p>
                <p className="mt-2 text-sm text-yellow-800">
                  This page is the first setup stage. The actual connector flow
                  will be added next.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
