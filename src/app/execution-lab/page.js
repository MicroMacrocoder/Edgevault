"use client";

// This lets us create clickable links between pages
import Link from "next/link";

// This creates the Execution Lab main page
export default function ExecutionLabPage() {
  return (
    <main className="min-h-screen bg-gray-100">
      
      {/* Top Navigation */}
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        
        {/* App Name */}
        <Link href="/" className="app-brand-title text-lg hover:opacity-80">
          Trading Journal
        </Link>

        {/* Back to Home */}
        <Link
          href="/"
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Back to Home
        </Link>
      </nav>

      {/* Page Content */}
      <section className="px-4 py-10 md:px-8">
        <div className="mx-auto max-w-5xl">

          {/* Header */}
          <div className="rounded-2xl bg-white p-6 shadow-sm md:p-10">
            <p className="text-sm font-medium text-gray-700">
              Control your trades, risk, and execution behavior
            </p>

            <h1 className="mt-3 text-3xl md:text-5xl">
              Execution Lab
            </h1>

            <p className="mt-4 max-w-2xl text-sm text-gray-700 md:text-base">
              This is where you plan how you trade. Define your risk model,
              control your trade execution, and build disciplined behavior.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">

            {/* Risk Management */}
            <Link
              href="/execution-lab/risk-management"
              className="rounded-xl bg-white p-5 shadow-sm transition hover:bg-gray-50 hover:shadow-lg"
            >
              <h2 className="app-card-title text-lg">Risk Management</h2>
              <p className="mt-2 text-sm text-gray-700">
                Calculate lot sizes, define your risk model, and control how much you lose or gain per trade.
              </p>
            </Link>

            {/* Trade Management */}
            <Link
              href="/execution-lab/trade-management"
              className="rounded-xl bg-white p-5 shadow-sm transition hover:bg-gray-50 hover:shadow-lg"
            >
              <h2 className="app-card-title text-lg">Trade Management</h2>
              <p className="mt-2 text-sm text-gray-700">
                Plan stop loss, take profit, partial closes, and how you manage trades after entry.
              </p>
            </Link>

            {/* Dynamic Risk Engine */}
            <Link
              href="/execution-lab/dynamic-risk-engine"
              className="rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 p-5 shadow-sm transition hover:shadow-lg hover:scale-[1.02] border border-cyan-900/30"
            >
              <h2 className="text-lg font-bold text-cyan-400">Dynamic Risk Engine</h2>
              <p className="mt-2 text-sm text-gray-300">
                4-style portfolio framework with auto lot sizing, live P&L tracking, zone visualization, and smart style switching.
              </p>
              <span className="mt-3 inline-block rounded-full bg-cyan-950/50 border border-cyan-700/30 px-2.5 py-0.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                Advanced
              </span>
            </Link>

          </div>
        </div>
      </section>
    </main>
  );
}
