"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Calculator,
  Cpu,
  LineChart,
  Lock,
  PieChart,
  Shield,
  Target,
  TrendingUp,
  Zap,
  Globe,
} from "lucide-react";

interface StatCardProps {
  value: string;
  label: string;
  color: "yellow" | "cyan" | "green" | "orange";
}

function StatCard({ value, label, color }: StatCardProps) {
  const colorClasses = {
    yellow: "text-yellow-400",
    cyan: "text-cyan-400",
    green: "text-green-400",
    orange: "text-orange-400",
  };

  return (
    <div className="border border-gray-700 bg-black p-6 text-center">
      <div className={`mb-2 font-mono text-3xl font-bold ${colorClasses[color]}`}>
        {value}
      </div>
      <div className="text-sm uppercase tracking-wider text-gray-400">
        {label}
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  href?: string;
  colorClass: string;
  buttonText: string;
  disabled?: boolean;
}

function FeatureCard({
  icon,
  label,
  title,
  description,
  href,
  colorClass,
  buttonText,
  disabled = false,
}: FeatureCardProps) {
  const content = (
    <div
      className={`group h-full border border-gray-800 bg-[#111111] p-8 transition ${
        disabled ? "cursor-not-allowed opacity-70" : "hover:border-yellow-400"
      }`}
    >
      <div className={`mb-5 inline-flex rounded-lg border border-gray-800 bg-black p-3 ${colorClass}`}>
        {icon}
      </div>

      <p className={`mb-3 font-mono text-xs uppercase tracking-[0.3em] ${colorClass}`}>
        {label}
      </p>

      <h3 className="mb-4 font-mono text-2xl font-bold text-white">{title}</h3>

      <p className="mb-8 text-sm leading-7 text-gray-400">{description}</p>

      <span
        className={`inline-flex items-center gap-2 font-mono text-sm font-bold ${
          disabled ? "text-gray-500" : colorClass
        }`}
      >
        {buttonText}
        {!disabled && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}
      </span>
    </div>
  );

  if (disabled || !href) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}

interface CarouselItem {
  id: number;
  title: string;
  description: string;
  image: string;
}

function ImageCarousel() {
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const items: CarouselItem[] = [
    {
      id: 1,
      title: "Trading Charts",
      description: "Entry & Exit Point Visualization",
      image:
        "https://d2xsxph8kpxj0f.cloudfront.net/310419663031839604/HPK6Ci2pNfiBhJVRkSJZVt/trading-charts-friendly-QJ25coXg4ENpsThEdo3a8X.webp",
    },
    {
      id: 2,
      title: "MT5 Integration",
      description: "Auto-Capture Trades",
      image:
        "https://d2xsxph8kpxj0f.cloudfront.net/310419663031839604/HPK6Ci2pNfiBhJVRkSJZVt/mt5-integration-friendly-T3qQo8JkyvMRWA4yiyCgFQ.webp",
    },
    {
      id: 3,
      title: "Fundamental Data",
      description: "Financial Metrics & Analysis",
      image:
        "https://d2xsxph8kpxj0f.cloudfront.net/310419663031839604/HPK6Ci2pNfiBhJVRkSJZVt/fundamental-data-friendly-XhzDCZ5uYkU4ra4BbHJr24.webp",
    },
    {
      id: 4,
      title: "Analysis Workspace",
      description: "Trading Thesis Builder",
      image:
        "https://d2xsxph8kpxj0f.cloudfront.net/310419663031839604/HPK6Ci2pNfiBhJVRkSJZVt/analysis-workspace-friendly-QgwiJCUi5WsonhpJofQ3LU.webp",
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [items.length]);

  const currentItem = items[currentIndex];

  return (
    <div className="relative w-full">
      <div className="relative w-full overflow-hidden rounded-lg border border-gray-800">
        <div className="relative h-[440px] w-full md:h-[600px]">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            </div>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
          <h5 className="mb-2 font-mono text-2xl font-bold">{currentItem.title}</h5>
          <p className="text-sm text-gray-300">{currentItem.description}</p>
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCurrentIndex(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              index === currentIndex ? "w-8 bg-yellow-400" : "w-2 bg-gray-600 hover:bg-gray-500"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-800 bg-black/95 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4 md:px-10">
          <Link href="/" className="inline-flex items-center">
            <img
              src="/edgevault-logo.png"
              alt="EdgeVault"
              className="h-12 w-auto object-contain md:h-14"
            />
          </Link>

          <div className="hidden gap-8 md:flex">
            <a
              href="#features"
              className="font-mono text-sm text-gray-400 transition hover:text-yellow-400"
            >
              Features
            </a>
            <Link
              href="/new-entry"
              className="font-mono text-sm text-gray-400 transition hover:text-yellow-400"
            >
              Analysis
            </Link>
            <Link
              href="/fundamentals"
              className="font-mono text-sm text-gray-400 transition hover:text-yellow-400"
            >
              Fundamentals
            </Link>
            <Link
              href="/journal"
              className="font-mono text-sm text-gray-400 transition hover:text-yellow-400"
            >
              Journal
            </Link>
            <Link
              href="/trade-log"
              className="font-mono text-sm text-gray-400 transition hover:text-yellow-400"
            >
              Trade Log
            </Link>
            <Link
              href="/execution-lab"
              className="font-mono text-sm text-gray-400 transition hover:text-yellow-400"
            >
              Execution Lab
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden font-mono text-sm text-gray-400 transition hover:text-cyan-400 sm:block"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="inline-block bg-yellow-400 px-5 py-2 font-mono text-sm font-bold text-black transition hover:bg-yellow-300"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pb-20 pt-36 text-center md:px-10 md:pt-44">
        <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-yellow-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl">
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.4em] text-cyan-400">
            Trading Intelligence Terminal
          </p>

          <h1 className="mb-6 font-mono text-5xl font-bold leading-tight md:text-7xl">
            Trading Intelligence <br />
            <span className="text-yellow-400">Refined</span>
            <span className="text-cyan-400">.</span>
          </h1>

          <p className="mx-auto mb-10 max-w-3xl text-base leading-8 text-gray-400 md:text-lg">
            EdgeVault combines analysis workspaces, journaling, trade logs, execution planning,
            and performance review into one clean trading operating system.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 bg-yellow-400 px-8 py-3 font-mono font-bold text-black transition hover:bg-yellow-300"
            >
              Start Free <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/execution-lab"
              className="border border-cyan-400 px-8 py-3 font-mono text-cyan-400 transition hover:bg-cyan-400/10"
            >
              Open Execution Lab
            </Link>
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="relative mb-20 px-6 md:px-10">
        <div className="border border-gray-800 bg-gradient-to-b from-gray-900 to-black p-8 shadow-2xl">
          <h3 className="mb-6 text-center font-mono text-2xl font-bold">
            <span className="text-yellow-400">Dashboard Preview:</span>{" "}
            Trading Charts, Analytics & Performance Metrics
          </h3>

          <div className="mb-8 grid gap-6 md:grid-cols-4">
            <StatCard value="248↑" label="Total Trades" color="yellow" />
            <StatCard value="78%" label="Win Rate" color="cyan" />
            <StatCard value="$15,450" label="Total Profit" color="green" />
            <StatCard value="2.4R" label="Avg R:R" color="orange" />
          </div>

          <ImageCarousel />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative mb-32 px-6 md:px-10">
        <h3 className="mb-12 text-center font-mono text-4xl font-bold md:text-5xl">
          Everything You Need to <span className="text-yellow-400">Win</span>
        </h3>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <FeatureCard
            icon={<BookOpen className="h-7 w-7" />}
            label="Thesis Building"
            title="Analysis Workspace"
            description="Build structured trading analysis using screenshots, timeframe blocks, rich notes, checklist logic, liquidity, displacement, and market structure."
            href="/new-entry"
            colorClass="text-orange-400"
            buttonText="Open Analysis"
          />

          <FeatureCard
            icon={<Brain className="h-7 w-7" />}
            label="Journal System"
            title="Journal Library"
            description="Save final trading analysis, review past decisions, connect entries to workspaces, and build a searchable trading record."
            href="/journal"
            colorClass="text-yellow-400"
            buttonText="Open Journal"
          />

          <FeatureCard
            icon={<Globe className="h-7 w-7" />}
            label="Market Context"
            title="Fundamentals"
            description="Track economic calendar events, high-impact news, forecast, previous, and actual data across major currencies."
            href="/fundamentals"
            colorClass="text-green-400"
            buttonText="Open Fundamentals"
          />

          <FeatureCard
            icon={<Calculator className="h-7 w-7" />}
            label="Execution Tools"
            title="Execution Lab"
            description="Plan risk, simulate outcomes, manage lot sizing, test risk models, and improve your trade execution before placing trades."
            href="/execution-lab"
            colorClass="text-cyan-400"
            buttonText="Open Lab"
          />
        </div>
      </section>
     {/* Analysis Workspace, Journal Library, Execution Lab, Trade Log Sections */}
      <section className="relative mb-32 px-6 md:px-10">
        <div className="space-y-32">
          {/* Analysis Workspace */}
          <div className="grid items-center gap-16 md:grid-cols-2">
            <div className="space-y-6">
              <span className="font-mono text-sm tracking-wider text-orange-400">
                ANALYSIS WORKSPACE
              </span>

              <h4 className="font-mono text-4xl font-bold leading-tight">
                Structure Your <span className="text-orange-400">Market Thesis</span>
              </h4>

              <p className="text-lg leading-relaxed text-gray-400">
                Create analysis blocks for high timeframe, medium timeframe, and entry timeframe.
                Upload charts, add notes, tick checklists, and turn analysis into journal entries.
              </p>

              <Link
                href="/new-entry"
                className="inline-flex bg-orange-400 px-6 py-3 font-mono font-bold text-black transition hover:bg-orange-300"
              >
                Open Analysis Workspace
              </Link>
            </div>

            <div className="flex h-96 items-center justify-center overflow-hidden rounded-xl border border-orange-900/30 bg-black/50 transition-all duration-300 hover:border-orange-400/50">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031839604/HPK6Ci2pNfiBhJVRkSJZVt/analysis-workspace-premium-FdruwJnQmp7sXCfyobbxHe.webp"
                alt="Analysis Workspace"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* Journal Library */}
          <div className="grid items-center gap-16 md:grid-cols-2">
            <div className="order-2 flex h-96 items-center justify-center overflow-hidden rounded-xl border border-yellow-900/30 bg-black/50 transition-all duration-300 hover:border-yellow-400/50 md:order-1">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031839604/HPK6Ci2pNfiBhJVRkSJZVt/advanced-analytics-premium-YmNUqjcb6om9MNNqYAPmXD.webp"
                alt="Journal Library"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="order-1 space-y-6 md:order-2">
              <span className="font-mono text-sm tracking-wider text-yellow-400">
                JOURNAL LIBRARY
              </span>

              <h4 className="font-mono text-4xl font-bold leading-tight">
                Turn Analysis Into <span className="text-yellow-400">Reviewable Data</span>
              </h4>

              <p className="text-lg leading-relaxed text-gray-400">
                Store saved journal entries, revisit screenshots and notes, and build a consistent
                record of how you think before and after each trading decision.
              </p>

              <Link
                href="/journal"
                className="inline-flex bg-yellow-400 px-6 py-3 font-mono font-bold text-black transition hover:bg-yellow-300"
              >
                Open Journal Library
              </Link>
            </div>
          </div>

          {/* Execution Lab */}
          <div className="grid items-center gap-16 md:grid-cols-2">
            <div className="space-y-6">
              <span className="font-mono text-sm tracking-wider text-cyan-400">
                EXECUTION LAB
              </span>

              <h4 className="font-mono text-4xl font-bold leading-tight">
                Plan Risk Before You <span className="text-cyan-400">Execute</span>
              </h4>

              <p className="text-lg leading-relaxed text-gray-400">
                Use risk calculators and execution planning tools to understand position size,
                stop distance, potential gain, possible loss, and trade scenarios before entry.
              </p>

              <Link
                href="/execution-lab"
                className="inline-flex bg-cyan-400 px-6 py-3 font-mono font-bold text-black transition hover:bg-cyan-300"
              >
                Open Execution Lab
              </Link>
            </div>

            <div className="flex h-96 items-center justify-center overflow-hidden rounded-xl border border-cyan-900/30 bg-black/50 transition-all duration-300 hover:border-cyan-400/50">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031839604/HPK6Ci2pNfiBhJVRkSJZVt/mt5-integration-premium-7DhFVT4iNhGAh7PU2qGKsP.webp"
                alt="Execution Lab"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* Trade Log */}
          <div className="grid items-center gap-16 md:grid-cols-2">
            <div className="order-2 flex h-96 items-center justify-center overflow-hidden rounded-xl border border-green-900/30 bg-black/50 transition-all duration-300 hover:border-green-400/50 md:order-1">
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031839604/HPK6Ci2pNfiBhJVRkSJZVt/trading-charts-premium-QPbavt2zbzMGE4EggmxT64.webp"
                alt="Trade Log"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="order-1 space-y-6 md:order-2">
              <span className="font-mono text-sm tracking-wider text-green-400">
                TRADE LOG
              </span>

              <h4 className="font-mono text-4xl font-bold leading-tight">
                Track Trades Your <span className="text-green-400">Own Way</span>
              </h4>

              <p className="text-lg leading-relaxed text-gray-400">
                Build custom trade logs with flexible headers, manual fields, automatic calculations,
                screenshots, notes, setups, and review-ready trade data.
              </p>

              <Link
                href="/trade-log"
                className="inline-flex bg-green-400 px-6 py-3 font-mono font-bold text-black transition hover:bg-green-300"
              >
                Open Trade Log
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Fundamental Data */}
      <section className="relative mb-20 px-6 md:px-10">
        <h3 className="mb-12 text-center font-mono text-3xl font-bold">
          <span className="text-yellow-400">Fundamental Data</span> & Smart Review
        </h3>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="border border-gray-800 bg-black p-8">
            <h4 className="mb-6 flex items-center gap-2 font-mono text-lg font-bold">
              <PieChart className="h-5 w-5 text-yellow-400" />
              Economic Calendar Layer
            </h4>

            <ul className="mb-8 space-y-3 text-sm text-gray-400">
              <li>• <span className="text-yellow-400">Economic calendar</span> for market-impacting news</li>
              <li>• <span className="text-yellow-400">Fundamental notes</span> linked to trade decisions</li>
              <li>• <span className="text-yellow-400">Session context</span> for London/New York trades</li>
              <li>• <span className="text-yellow-400">News review</span> to compare expectation vs reaction</li>
            </ul>

            <Link
              href="/fundamentals"
              className="inline-flex items-center gap-2 border border-yellow-400/50 px-4 py-2 font-mono text-xs font-bold text-yellow-400 transition hover:bg-yellow-400/10"
            >
              Open Economic Calendar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="border border-gray-800 bg-black p-8">
            <h4 className="mb-6 flex items-center gap-2 font-mono text-lg font-bold">
              <Cpu className="h-5 w-5 text-cyan-400" />
              Smart Calculations
            </h4>

            <ul className="space-y-3 text-sm text-gray-400">
              <li>• <span className="text-cyan-400">Risk/Reward Ratio</span> tracking</li>
              <li>• <span className="text-cyan-400">Drawdown Analysis</span> planning</li>
              <li>• <span className="text-cyan-400">Win Rate Review</span> by setup</li>
              <li>• <span className="text-cyan-400">Execution Review</span> plan vs result</li>
            </ul>
          </div>
        </div>
      </section>
     {/* Trading Workflow */}
      <section className="relative mb-20 px-6 md:px-10">
        <h3 className="mb-12 text-center font-mono text-3xl font-bold">
          Your <span className="text-cyan-400">Trading Workflow</span>
        </h3>

        <div className="grid gap-6 md:grid-cols-4">
          {[
            {
              icon: <Target className="mx-auto mb-4 h-8 w-8 text-yellow-400" />,
              num: "1",
              title: "Prepare",
              desc: "Plan risk and review market context.",
            },
            {
              icon: <LineChart className="mx-auto mb-4 h-8 w-8 text-orange-400" />,
              num: "2",
              title: "Analyze",
              desc: "Build thesis in the analysis workspace.",
            },
            {
              icon: <Zap className="mx-auto mb-4 h-8 w-8 text-cyan-400" />,
              num: "3",
              title: "Execute",
              desc: "Use execution tools and record your trade.",
            },
            {
              icon: <TrendingUp className="mx-auto mb-4 h-8 w-8 text-green-400" />,
              num: "4",
              title: "Learn",
              desc: "Review journals and improve your setups.",
            },
          ].map((step) => (
            <div key={step.num} className="border border-gray-800 bg-black p-6 text-center">
              {step.icon}
              <div className="mb-4 font-mono text-4xl font-bold text-yellow-400">
                {step.num}
              </div>
              <h4 className="mb-2 font-mono text-lg font-bold">{step.title}</h4>
              <p className="text-sm text-gray-400">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section: Level Up */}
      <section className="relative mb-20 px-6 md:px-10">
        <div className="border border-gray-800 bg-gradient-to-b from-gray-900 to-black p-8 md:p-12">
          <div className="mx-auto max-w-4xl text-center">
            <h3 className="mb-6 font-mono text-4xl font-bold">
              Ready to <span className="text-yellow-400">Level Up</span>?
            </h3>
            <p className="mb-10 text-lg text-gray-400">
              Join professional traders using EdgeVault to structure their analysis and improve execution.
            </p>
            <Link
              href="/signup"
              className="inline-flex bg-yellow-400 px-10 py-4 font-mono text-lg font-bold text-black transition hover:bg-yellow-300"
            >
              Get Started Now
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-6 md:px-10">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <img src="/edgevault-logo.png" alt="EdgeVault" className="h-8 w-auto" />
            <span className="font-mono text-sm text-gray-500">© 2026 EdgeVault Intelligence.</span>
          </div>
          <div className="flex gap-8">
            <Link href="#" className="font-mono text-xs text-gray-500 hover:text-white">Terms</Link>
            <Link href="#" className="font-mono text-xs text-gray-500 hover:text-white">Privacy</Link>
            <Link href="#" className="font-mono text-xs text-gray-500 hover:text-white">Support</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
