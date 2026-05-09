import Link from "next/link";
import { BarChart3, CalendarDays, LineChart } from "lucide-react";

const fundamentalModules = [
  {
    title: "Economic Calendar",
    description:
      "Track live economic releases, impact levels, forecasts, previous values, and actual results.",
    href: "/fundamentals/calendar",
    icon: CalendarDays,
    status: "Live",
  },
  {
    title: "Commitment of Traders",
    description:
      "Analyze commercial hedgers, non-commercial speculators, and small trader positioning.",
    href: "/fundamentals/cot",
    icon: LineChart,
    status: "Coming Next",
  },
  {
    title: "Volume & Open Interest",
    description:
      "Monitor futures market participation using volume, open interest, daily change, and percentage change.",
    href: "/fundamentals/volume-oi",
    icon: BarChart3,
    status: "Coming Next",
  },
];

export default function FundamentalsHubPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
            EdgeVault Fundamental Intelligence
          </p>

          <h1 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
            Fundamentals <span className="text-yellow-400">Hub</span>
          </h1>

          <p className="max-w-3xl font-mono text-sm leading-relaxed text-gray-400">
            A command center for economic calendar data, Commitment of Traders
            positioning, volume analysis, and open interest intelligence.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {fundamentalModules.map((module) => {
            const Icon = module.icon;

            return (
              <Link
                key={module.href}
                href={module.href}
                className="group rounded-2xl border border-gray-800 bg-[#0a0a0a] p-6 transition hover:border-cyan-400/60 hover:bg-cyan-400/5"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
                    <Icon className="h-6 w-6 text-cyan-400" />
                  </div>

                  <span className="rounded-full border border-yellow-400/30 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-yellow-400">
                    {module.status}
                  </span>
                </div>

                <h2 className="mb-3 font-mono text-xl font-bold text-white group-hover:text-yellow-400">
                  {module.title}
                </h2>

                <p className="font-mono text-sm leading-relaxed text-gray-500">
                  {module.description}
                </p>

                <div className="mt-6 font-mono text-xs uppercase tracking-widest text-cyan-400">
                  Open Module →
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
