import { calcKwh, effectiveTariff, formatBrl, formatNumber } from "@/src/lib/energy";
import type { Project } from "@/src/types/energy";

const SEGMENT_COLORS = [
  "var(--yellow)",
  "var(--chart-mint)",
  "var(--chart-blue)",
  "#ff8a5c",
  "#b388ff",
  "var(--chart-neutral)",
];

export function ConsumptionRing({ project }: { project: Project }) {
  const tariff = effectiveTariff(project);
  const totalKwh = project.equipments.reduce((acc, eq) => acc + calcKwh(eq), 0);
  const totalCost = totalKwh * tariff;
  const annualCost = totalCost * 12;

  const grouped = [...new Set(project.equipments.map((eq) => eq.category))]
    .map((category) => ({
      category,
      value: project.equipments
        .filter((eq) => eq.category === category)
        .reduce((acc, eq) => acc + calcKwh(eq), 0),
    }))
    .sort((a, b) => b.value - a.value);

  const categories =
    grouped.length <= 6
      ? grouped
      : [
          ...grouped.slice(0, 5),
          {
            category: "Outros",
            value: grouped.slice(5).reduce((acc, item) => acc + item.value, 0),
          },
        ];

  let offset = 0;
  const circumference = 2 * Math.PI * 78;

  return (
    <section className="energy-overview card">
      <div className="overview-heading">
        <span>Custo estimado do mês</span>
        <span className="period-label tabular-nums">{project.days} dias</span>
      </div>

      <div className="ring-wrap">
        <svg
          className="consumption-ring"
          viewBox="0 0 200 200"
          aria-label="Participação das categorias no consumo"
        >
          <circle className="ring-track" cx="100" cy="100" r="78" strokeWidth="14" />
          {categories.map((cat, idx) => {
            const arc = totalKwh ? (cat.value / totalKwh) * circumference : 0;
            const currentOffset = offset;
            offset += arc;
            const dash = Math.max(0, arc - (categories.length > 1 ? 4 : 0));
            return (
              <circle
                key={cat.category}
                className="chart-segment"
                style={{ stroke: SEGMENT_COLORS[idx % SEGMENT_COLORS.length] }}
                cx="100"
                cy="100"
                r="78"
                strokeWidth="14"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-currentOffset}
              />
            );
          })}
        </svg>
        <div className="ring-center">
          <div>
            <div className="value tabular-nums">{formatBrl(totalCost)}</div>
            <div className="sub tabular-nums">{formatNumber(totalKwh)} kWh / mês</div>
            <div className="ring-annual tabular-nums">~{formatBrl(annualCost)}/ano</div>
          </div>
        </div>
      </div>

      <div className="ring-category-list">
        {categories.map((cat, idx) => {
          const pct = totalKwh ? (cat.value / totalKwh) * 100 : 0;
          return (
            <div key={cat.category} className="ring-category-row">
              <div className="ring-category-label">
                <i
                  className="dot"
                  style={{ background: SEGMENT_COLORS[idx % SEGMENT_COLORS.length] }}
                />
                <span className="ellipsis">{cat.category}</span>
              </div>
              <div className="ring-category-metrics tabular-nums">
                <span>{formatNumber(cat.value, 1)} kWh</span>
                <span className="muted">{formatBrl(cat.value * tariff)}</span>
                <b>{formatNumber(pct, 0)}%</b>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
