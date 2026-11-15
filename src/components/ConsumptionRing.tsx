import { calcKwh, effectiveTariff, formatBrl, formatNumber } from "@/src/lib/energy";
import type { Project } from "@/src/types/energy";

export function ConsumptionRing({ project }: { project: Project }) {
  const totalKwh = project.equipments.reduce((acc, eq) => acc + calcKwh(eq), 0);
  const categories = [...new Set(project.equipments.map((eq) => eq.category))]
    .map((category) => ({
      category,
      value: project.equipments
        .filter((eq) => eq.category === category)
        .reduce((acc, eq) => acc + calcKwh(eq), 0),
    }))
    .sort((a, b) => b.value - a.value);

  let offset = 0;
  const circumference = 2 * Math.PI * 78;

  return (
    <section className="energy-overview">
      <div className="overview-heading">
        <span>Custo estimado do mês</span>
        <span className="period-label">{project.days} dias</span>
      </div>
      <div className="ring-wrap">
        <svg
          className="consumption-ring"
          viewBox="0 0 200 200"
          aria-label="Participação das categorias no consumo"
        >
          <circle className="ring-track" cx="100" cy="100" r="78" strokeWidth="13" />
          {categories.map((cat, idx) => {
            const arc = totalKwh ? (cat.value / totalKwh) * circumference : 0;
            const currentOffset = offset;
            offset += arc;
            const dash = Math.max(0, arc - 4);
            return (
              <circle
                key={cat.category}
                className={`chart-segment segment-${idx % 4}`}
                cx="100"
                cy="100"
                r="78"
                strokeWidth="13"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-currentOffset}
              />
            );
          })}
        </svg>
        <div className="ring-center">
          <div>
            <div className="value">{formatBrl(totalKwh * effectiveTariff(project))}</div>
            <div className="sub">{formatNumber(totalKwh)} kWh / mês</div>
          </div>
        </div>
      </div>
      <div className="legend justify-center">
        {categories.slice(0, 4).map((cat, idx) => (
          <span key={cat.category} className="legend-item">
            <i className={`dot segment-fill-${idx % 4}`} />
            {cat.category} <b>{formatNumber(totalKwh ? (cat.value / totalKwh) * 100 : 0, 0)}%</b>
          </span>
        ))}
      </div>
    </section>
  );
}
