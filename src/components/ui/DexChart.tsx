"use client";

export default function DexChart() {
  return (
    <div className="w-full">
      <div className="mb-4 grid grid-cols-3 gap-3">
        {[
          { label: "MCAP", value: "SOON" },
          { label: "LIQUIDITY", value: "SOON" },
          { label: "24H", value: "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="neon-border rounded-lg bg-deep-purple/40 px-3 py-2 text-center"
          >
            <p className="font-mono text-[10px] text-foreground/50">
              {stat.label}
            </p>
            <p className="font-mono text-sm font-bold text-foreground/40">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="dex-iframe chart-placeholder relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#0a0a12]">
        <div className="chart-placeholder-grid absolute inset-0" aria-hidden="true" />

        <div className="absolute top-3 left-4 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-neon-green/80" />
          <span className="ml-2 font-mono text-[10px] text-foreground/30">
            tired-chart.exe
          </span>
        </div>

        <div className="chart-placeholder-content">
          <p
            className="chart-corner-text chart-corner-top-right font-mono font-black uppercase tracking-tight text-neon-pink"
            aria-hidden="true"
          >
            not deployed yet
          </p>

          <p className="chart-corner-text chart-corner-bottom-left font-mono font-black uppercase tracking-tight text-neon-green neon-green-glow">
            $TIRED chart, coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
