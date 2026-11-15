import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  calcKwh,
  displayTitle,
  effectiveTariff,
  formatBrl,
  formatNumber,
} from "@/src/lib/energy";
import type { Project } from "@/src/types/energy";

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type ChartMode = "days" | "rooms" | "appliances" | "categories";
type UnitMode = "kwh" | "brl";

interface HorizontalBarItem {
  id: string;
  label: string;
  sub?: string;
  kwh: number;
  brl: number;
}

const BAR_COLORS = [
  "var(--chart-mint)",
  "var(--yellow)",
  "var(--chart-blue)",
  "#ff8a5c",
  "#b388ff",
  "var(--chart-neutral)",
];

export function UsageChart({ project }: { project: Project }) {
  const [mode, setMode] = useState<ChartMode>("days");
  const [unit, setUnit] = useState<UnitMode>("kwh");

  const tariff = effectiveTariff(project);
  const totalMonthlyKwh = project.equipments.reduce((acc, eq) => acc + calcKwh(eq), 0);

  const weeklyBars = WEEK_DAYS.map((label, dayIdx) => {
    const kwh = project.equipments.reduce((acc, eq) => {
      if (eq.monthlyKwh != null) {
        return acc + calcKwh(eq) / project.days;
      }
      const dayHours =
        eq.weeklyMinutes?.[dayIdx] == null
          ? eq.hours * eq.factor
          : (eq.weeklyMinutes[dayIdx] ?? 0) / 60;
      return acc + (eq.powerW / 1000) * eq.qty * dayHours;
    }, 0);
    return { label, kwh, brl: kwh * tariff };
  });

  const roomBars: HorizontalBarItem[] = project.environments
    .map((env) => {
      const kwh = project.equipments
        .filter((eq) => eq.envId === env.id)
        .reduce((acc, eq) => acc + calcKwh(eq), 0);
      return { id: env.id, label: env.name, kwh, brl: kwh * tariff };
    })
    .sort((a, b) => b.kwh - a.kwh);

  const applianceBars: HorizontalBarItem[] = [...project.equipments]
    .map((eq) => {
      const kwh = calcKwh(eq);
      const envName = project.environments.find((e) => e.id === eq.envId)?.name;
      return {
        id: eq.id,
        label: displayTitle(eq.name),
        sub: envName,
        kwh,
        brl: kwh * tariff,
      };
    })
    .sort((a, b) => b.kwh - a.kwh)
    .slice(0, 8);

  const categoryBars: HorizontalBarItem[] = [...new Set(project.equipments.map((eq) => eq.category))]
    .map((category) => {
      const kwh = project.equipments
        .filter((eq) => eq.category === category)
        .reduce((acc, eq) => acc + calcKwh(eq), 0);
      return { id: category, label: category, kwh, brl: kwh * tariff };
    })
    .sort((a, b) => b.kwh - a.kwh);

  const weeklyMax = Math.max(0.1, ...weeklyBars.map((b) => (unit === "kwh" ? b.kwh : b.brl)));
  const weeklyAvg =
    weeklyBars.reduce((acc, b) => acc + (unit === "kwh" ? b.kwh : b.brl), 0) / 7;
  const peakDay = [...weeklyBars].sort((a, b) => b.kwh - a.kwh)[0];

  const horizontalItems: HorizontalBarItem[] =
    mode === "rooms"
      ? roomBars.slice(0, 10)
      : mode === "appliances"
        ? applianceBars
        : categoryBars;

  const horizontalMax = Math.max(
    0.1,
    ...horizontalItems.map((item) => (unit === "kwh" ? item.kwh : item.brl))
  );

  const subtitles: Record<ChartMode, string> = {
    days: "Rotina semanal estimada por dia",
    rooms: `Consumo mensal por ambiente${roomBars.length > 10 ? " (top 10)" : ""}`,
    appliances: "Maiores consumidores cadastrados",
    categories: "Distribuição por categoria",
  };

  return (
    <section className="usage-section card">
      <div className="usage-heading-wrap">
        <div>
          <h2>Gráficos de consumo</h2>
          <p>{subtitles[mode]}</p>
        </div>
        <div className="chart-controls-row">
          <div className="chart-switch" role="group" aria-label="Unidade do gráfico">
            <Button
              variant="ghost"
              aria-pressed={unit === "kwh"}
              onClick={() => setUnit("kwh")}
            >
              kWh
            </Button>
            <Button
              variant="ghost"
              aria-pressed={unit === "brl"}
              onClick={() => setUnit("brl")}
            >
              R$
            </Button>
          </div>
        </div>
      </div>

      <div className="chart-mode-tabs" role="tablist" aria-label="Tipo de gráfico">
        {(
          [
            ["days", "Semana"],
            ["rooms", "Ambientes"],
            ["appliances", "Aparelhos"],
            ["categories", "Categorias"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            variant="ghost"
            role="tab"
            aria-selected={mode === id}
            aria-pressed={mode === id}
            className="chart-mode-btn"
            onClick={() => setMode(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {mode === "days" ? (
        <>
          <div className="weekly-summary-strip tabular-nums">
            <span>
              Pico: <b>{peakDay?.label}</b> ({unit === "kwh" ? `${formatNumber(peakDay?.kwh ?? 0, 1)} kWh` : formatBrl(peakDay?.brl ?? 0)})
            </span>
            <span>
              Média/dia: <b>{unit === "kwh" ? `${formatNumber(weeklyAvg, 1)} kWh` : formatBrl(weeklyAvg)}</b>
            </span>
          </div>
          <div className="usage-chart-frame">
            <div
              className="usage-avg-line"
              style={{ bottom: `${28 + Math.min(96, (weeklyAvg / weeklyMax) * 108)}px` }}
              title="Média diária"
            />
            <div
              className="usage-bars"
              role="img"
              aria-label={weeklyBars
                .map((b) =>
                  `${b.label}: ${
                    unit === "kwh" ? `${formatNumber(b.kwh)} kWh` : formatBrl(b.brl)
                  }`
                )
                .join("; ")}
            >
              {weeklyBars.map((bar, idx) => {
                const val = unit === "kwh" ? bar.kwh : bar.brl;
                const isPeak = peakDay?.label === bar.label && val > 0;
                return (
                  <div key={bar.label} className="usage-column">
                    <span className={`bar-value tabular-nums ${isPeak ? "yellow" : ""}`}>
                      {unit === "kwh" ? formatNumber(val, 1) : formatNumber(val, 2)}
                    </span>
                    <div className="usage-track">
                      <div
                        className={`usage-fill ${isPeak ? "is-peak" : ""}`}
                        style={{
                          height: `${Math.max(4, (val / weeklyMax) * 100)}%`,
                          animationDelay: `${idx * 45}ms`,
                        }}
                      />
                    </div>
                    <span className="bar-label">{bar.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="hbar-list">
          {horizontalItems.map((item, idx) => {
            const val = unit === "kwh" ? item.kwh : item.brl;
            const share = totalMonthlyKwh ? (item.kwh / totalMonthlyKwh) * 100 : 0;
            const widthPct = Math.max(3, (val / horizontalMax) * 100);
            const color = BAR_COLORS[idx % BAR_COLORS.length];
            return (
              <div key={item.id} className="hbar-row">
                <div className="hbar-head">
                  <div className="hbar-name">
                    <span className="ellipsis">{item.label}</span>
                    {"sub" in item && item.sub && (
                      <small className="muted ellipsis">· {item.sub}</small>
                    )}
                  </div>
                  <div className="hbar-values tabular-nums">
                    <b>{unit === "kwh" ? `${formatNumber(item.kwh, 1)} kWh` : formatBrl(item.brl)}</b>
                    <span className="muted">{formatNumber(share, 0)}%</span>
                  </div>
                </div>
                <div className="hbar-track">
                  <div
                    className="hbar-fill"
                    style={{
                      width: `${widthPct}%`,
                      background: color,
                      animationDelay: `${idx * 40}ms`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="chart-footnote">
        {unit === "kwh" ? "Valores em kWh" : "Valores estimados em R$"} · atualização em tempo real
      </div>
    </section>
  );
}
