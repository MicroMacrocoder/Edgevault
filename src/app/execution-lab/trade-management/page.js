"use client";

// This lets us create links between pages
import Link from "next/link";

// This creates the Trade Management page
export default function TradeManagementPage() {
  return (
    <main className="min-h-screen bg-gray-100">
      {/* Top navigation */}
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        <Link
          href="/execution-lab"
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Back
        </Link>
      </nav>

      {/* Page content */}
      <section className="px-4 py-10 md:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="rounded-2xl bg-white p-6 shadow-sm md:p-10">
            <p className="text-sm font-medium text-gray-700">
              Execution Lab
            </p>

            <h1 className="mt-3 text-3xl md:text-5xl">
              Trade Management
            </h1>

            <p className="mt-4 max-w-2xl text-sm text-gray-700 md:text-base">
              This section will help you plan what happens after entry:
              stop loss movement, take profit targets, partial closes,
              break-even rules, and active trade decisions.
            </p>

            <p className="mt-4 rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
              Coming soon: we will design this properly after the risk
              management section is stable.
            </p>
          </div>

          {/* Future trade management ideas */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="app-card-title text-lg">
                Stop Loss Management
              </h2>
              <p className="mt-2 text-sm text-gray-700">
                Plan where your stop loss starts, when it should move,
                and when the trade becomes invalid.
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="app-card-title text-lg">
                Take Profit Planning
              </h2>
              <p className="mt-2 text-sm text-gray-700">
                Plan your TP1, TP2, TP3, full close target, and expected reward.
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="app-card-title text-lg">
                Partial Close Planner
              </h2>
              <p className="mt-2 text-sm text-gray-700">
                Decide how much of the position to close at each target
                before the trade starts.
              </p>
            </div>

            <div className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="app-card-title text-lg">
                Break-Even Rules
              </h2>
              <p className="mt-2 text-sm text-gray-700">
                Define when to move stop loss to entry, protect profit,
                or leave the trade unchanged.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
