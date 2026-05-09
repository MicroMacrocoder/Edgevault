import COTAnalysis from "@/components/fundamentals/COTAnalysis";

export default function COTPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10">
          <a
            href="/fundamentals"
            className="mb-6 inline-block font-mono text-sm text-gray-400 hover:text-yellow-400"
          >
            ← Back to Fundamentals Hub
          </a>

          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-cyan-400">
            Fundamental Positioning Intelligence
          </p>

          <h1 className="mb-4 font-mono text-4xl font-bold md:text-5xl">
            Commitment of <span className="text-yellow-400">Traders</span>
          </h1>

          <p className="max-w-3xl font-mono text-sm leading-relaxed text-gray-400">
            Analyze weekly CFTC positioning across major currency futures,
            including commercial hedgers, non-commercial speculators, and
            non-reportable traders.
          </p>
        </header>

        <COTAnalysis />
      </div>
    </main>
  );
}
