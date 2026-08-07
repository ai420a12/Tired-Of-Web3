import { RARITY_LEGEND } from "./hood-rarity";

export default function HoodRarityLegend() {
  return (
    <div
      className="hrpc-rarity-legend"
      role="group"
      aria-label="OpenSea NFT rarity.rank bands. Rank 1 is rarest in the collection."
      title="OpenSea’s API exposes rarity.rank when it exists (1 = rarest in that collection). We paint rings using these numeric ranges."
    >
      <div className="hrpc-rarity-legend-label-col">
        <span className="hrpc-rarity-legend-label">Rank</span>
      </div>
      <div className="hrpc-rarity-legend-items">
        {RARITY_LEGEND.map((item) => (
          <div key={item.tier} className="hrpc-rarity-legend-item">
            <span
              className={`hrpc-rarity-cube hrpc-rarity-cube-${item.tier}`}
              title={item.title}
            />
            <span className="hrpc-rarity-legend-range">{item.range}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
