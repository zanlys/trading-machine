"use client";

import { useState, useMemo } from "react";
import { useScanner } from "@/hooks/useScanner";
import { Header } from "@/components/Header";
import { ScanProgress } from "@/components/ScanProgress";
import { FilterBar, type FilterType } from "@/components/FilterBar";
import { SignalCard } from "@/components/SignalCard";
import { TradingViewWidget } from "@/components/TradingViewWidget";
import { DetailPanel } from "@/components/DetailPanel";
import type { SignalData } from "@/types";
import { AlertCircle, Radar } from "lucide-react";

export default function Home() {
  const { signals, status, connected, error, triggerScan } = useScanner();

  const [activeSignal, setActiveSignal] = useState<SignalData | null>(null);
  const [filter,       setFilter]       = useState<FilterType>("all");
  const [search,       setSearch]       = useState("");

  // Auto-select the top signal when new scan completes
  const prevCount = signals.length;
  useMemo(() => {
    if (signals.length > 0 && !activeSignal) {
      setActiveSignal(signals[0]);
    }
  }, [signals]); // eslint-disable-line

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (filter === "long"  && s.signal !== "long")  return false;
      if (filter === "short" && s.signal !== "short") return false;
      if (search && !s.symbol.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [signals, filter, search]);

  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      {/* ── Top bar ── */}
      <Header status={status} connected={connected} onTrigger={triggerScan} />

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-2 bg-bear/10 border-b border-bear/30 px-4 py-2 text-xs text-bear">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left panel – signal list ── */}
        <aside className="flex flex-col w-[300px] shrink-0 border-r border-bg-border bg-bg-secondary">
          <ScanProgress status={status} />
          <FilterBar
            filter={filter} onFilter={setFilter}
            search={search} onSearch={setSearch}
            count={filtered.length}
          />

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-600">
                <Radar className={`w-10 h-10 ${status.running ? "scan-pulse" : ""}`} />
                <p className="text-xs text-center">
                  {status.running
                    ? "Scanning markets…"
                    : "No signals found.\nTry scanning now."}
                </p>
              </div>
            ) : (
              filtered.map((sig) => (
                <SignalCard
                  key={sig.symbol}
                  data={sig}
                  active={activeSignal?.symbol === sig.symbol}
                  onClick={() => setActiveSignal(sig)}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── Center – TradingView chart ── */}
        <main className="flex-1 min-w-0 bg-bg-primary flex flex-col">
          {activeSignal ? (
            <TradingViewWidget
              symbol={activeSignal.symbol}
              interval={status.config?.timeframe ?? "1h"}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center flex-col gap-4 text-neutral-700">
              <Radar className="w-16 h-16" />
              <p className="text-sm">Select a signal to view the chart</p>
            </div>
          )}
        </main>

        {/* ── Right panel – detail ── */}
        {activeSignal && (
          <aside className="w-[260px] shrink-0 border-l border-bg-border bg-bg-secondary">
            <DetailPanel data={activeSignal} />
          </aside>
        )}
      </div>
    </div>
  );
}
