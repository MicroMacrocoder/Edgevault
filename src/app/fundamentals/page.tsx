import EconomicCalendar from "@/components/fundamentals/EconomicCalendar";

export default function FundamentalsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10">
          <a
            href="/"
            className="mb-6 inline-block font-mono text-sm text-gray-400 hover:text-yellow-400"
          >
            ← Back
          </a>

          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
            Market Intelligence Terminal
          </p>

          <h1 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
            Economic <span className="text-yellow-400">Calendar</span>
          </h1>

          <p className="max-w-2xl font-mono text-sm leading-relaxed text-gray-400">
            Track global economic events that may affect market volatility.
          </p>
        </header>

        <EconomicCalendar />
      </div>
    </main>
  );
}
