import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { calcKwh, formatNumber } from "@/src/lib/energy";
import type { Project } from "@/src/types/energy";

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function UsageChart({ project }: { project: Project }) {
  const [mode, setMode] = useState<"days" | "rooms">("days");

  const bars =
    mode === "days"
      ? WEEK_DAYS.map((label, dayIdx) => ({
          label,
          value: project.equipments.reduce((acc, eq) => {
            if (eq.monthlyKwh != null) {
              return acc + calcKwh(eq) / project.days;
            }
            const dayHours =
              eq.weeklyMinutes?.[dayIdx] == null
                ? eq.hours * eq.factor
                : (eq.weeklyMinutes[dayIdx] ?? 0) / 60;
            return acc + (eq.powerW / 1000) * eq.qty * dayHours;
          }, 0),
        }))
      : project.environments.map((env) => ({
          label: env.name,
          value: project.equipments
            .filter((eq) => eq.envId === env.id)
            .reduce((acc, eq) => acc + calcKwh(eq), 0),
        }));

  const maxValue = Math.max(1, ...bars.map((b) => b.value));

  return (
    <section className="usage-section">
      <div className="usage-heading">
        <div>
          <h2>Seu consumo</h2>
          <p>{mode === "days" ? "Rotina semanal estimada" : "Consumo mensal por ambiente"}</p>
        </div>
        <div className="chart-switch">
          <Button
            variant="ghost"
            aria-pressed={mode === "days"}
            onClick={() => setMode("days")}
          >
            Semana
          </Button>
          <Button
            variant="ghost"
            aria-pressed={mode === "rooms"}
            onClick={() => setMode("rooms")}
          >
            Ambientes
          </Button>
        </div>
      </div>

      <div
        className="usage-bars"
        role="img"
        aria-label={bars.map((b) => `${b.label}: ${formatNumber(b.value)} kWh`).join("; ")}
      >
        {bars.map((bar, idx) => (
          <div key={`${bar.label}-${idx}`} className="usage-column">
            <span className="bar-value">{formatNumber(bar.value, 1)}</span>
            <div className="usage-track">
              <div
                className="usage-fill"
                style={{
                  height: `${Math.max(2, (bar.value / maxValue) * 100)}%`,
                  animationDelay: `${idx * 55}ms`,
                }}
              />
            </div>
            <span className="bar-label" title={bar.label}>
              {bar.label}
            </span>
          </div>
        ))}
      </div>

      <div className="chart-footnote">kWh · estimativa a partir do uso cadastrado</div>
    </section>
  );
}
