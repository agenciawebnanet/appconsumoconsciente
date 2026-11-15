import { useState } from "react";
import { FileDown, RotateCcw } from "lucide-react";
import { AppIcon } from "@/src/components/AppIcon";
import { SectionTitle } from "@/src/components/SharedPrimitives";
import { Button } from "@/src/components/ui/button";
import { Slider } from "@/src/components/ui/slider";
import {
  avgDailyMinutes,
  calcKwh,
  displayTitle,
  effectiveTariff,
  formatBrl,
  formatDuration,
  formatNumber,
  inferIconName,
  modelDetail,
  simulateKwh,
} from "@/src/lib/energy";
import type { Project } from "@/src/types/energy";

type SimMetric = "kwh" | "brl" | "annual";

export function SimulatorView({
  project,
  sim,
  setSim,
  onExportPdf,
}: {
  project: Project;
  sim: Record<string, number>;
  setSim: (next: Record<string, number>) => void;
  onExportPdf?: () => void;
}) {
  const [metric, setMetric] = useState<SimMetric>("brl");
  const [chartFilter, setChartFilter] = useState<"all" | "changed">("all");

  const tariff = effectiveTariff(project);

  const items = project.equipments.map((eq) => {
    const origMin = avgDailyMinutes(eq);
    const simMin = sim[eq.id] ?? origMin;
    const origKwh = calcKwh(eq);
    const simKwh = simulateKwh(eq, simMin);
    const origBrl = origKwh * tariff;
    const simBrl = simKwh * tariff;
    const changed = Math.abs(simMin - origMin) > 0.05;
    return {
      eq,
      origMin,
      simMin,
      origKwh,
      simKwh,
      origBrl,
      simBrl,
      deltaKwh: origKwh - simKwh,
      deltaBrl: origBrl - simBrl,
      changed,
    };
  });

  const originalKwh = items.reduce((acc, item) => acc + item.origKwh, 0);
  const simulatedKwh = items.reduce((acc, item) => acc + item.simKwh, 0);
  const originalBrl = originalKwh * tariff;
  const simulatedBrl = simulatedKwh * tariff;
  const deltaKwh = originalKwh - simulatedKwh;
  const deltaBrl = originalBrl - simulatedBrl;
  const deltaAnnualBrl = deltaBrl * 12;
  const deltaPct = originalKwh > 0 ? (deltaKwh / originalKwh) * 100 : 0;
  const hasChanges = items.some((item) => item.changed);

  const formatMetric = (kwh: number, brl: number) => {
    if (metric === "kwh") return `${formatNumber(kwh, 1)} kWh`;
    if (metric === "annual") return `${formatBrl(brl * 12)}/ano`;
    return formatBrl(brl);
  };

  const applyPresetReduction = (reductionFraction: number) => {
    const next: Record<string, number> = {};
    for (const item of items) {
      next[item.eq.id] = Number((item.origMin * (1 - reductionFraction)).toFixed(1));
    }
    setSim(next);
  };

  const chartItemsSource =
    chartFilter === "changed" && hasChanges
      ? items.filter((i) => i.changed)
      : [...items].sort((a, b) => {
          if (a.changed !== b.changed) return a.changed ? -1 : 1;
          return Math.max(b.origKwh, b.simKwh) - Math.max(a.origKwh, a.simKwh);
        });
  const chartItems = chartItemsSource.slice(0, 8);
  const maxItemVal = Math.max(
    0.1,
    ...chartItems.map((item) =>
      metric === "kwh"
        ? Math.max(item.origKwh, item.simKwh)
        : metric === "annual"
          ? Math.max(item.origBrl * 12, item.simBrl * 12)
          : Math.max(item.origBrl, item.simBrl)
    )
  );

  const envComparison = project.environments
    .map((env) => {
      const envItems = items.filter((i) => i.eq.envId === env.id);
      const origKwh = envItems.reduce((acc, i) => acc + i.origKwh, 0);
      const simKwh = envItems.reduce((acc, i) => acc + i.simKwh, 0);
      return {
        env,
        origKwh,
        simKwh,
        origBrl: origKwh * tariff,
        simBrl: simKwh * tariff,
      };
    })
    .sort((a, b) => Math.max(b.origKwh, b.simKwh) - Math.max(a.origKwh, a.simKwh))
    .slice(0, 8);

  const maxEnvVal = Math.max(
    0.1,
    ...envComparison.map((item) =>
      metric === "kwh"
        ? Math.max(item.origKwh, item.simKwh)
        : metric === "annual"
          ? Math.max(item.origBrl * 12, item.simBrl * 12)
          : Math.max(item.origBrl, item.simBrl)
    )
  );

  const globalMax = Math.max(0.1, originalKwh, simulatedKwh);
  const isSaving = deltaKwh > 0.01;
  const isIncreasing = deltaKwh < -0.01;

  return (
    <>
      <section className="card hero sim-hero-card">
        <div className="sim-hero-top">
          <div>
            <div className="tiny muted">Comparativo da simulação</div>
            <h2 className="sim-hero-title">Antes vs. Depois dos ajustes</h2>
          </div>
          <div className="chart-switch" role="group" aria-label="Métrica da simulação">
            <Button
              variant="ghost"
              aria-pressed={metric === "brl"}
              onClick={() => setMetric("brl")}
            >
              R$/mês
            </Button>
            <Button
              variant="ghost"
              aria-pressed={metric === "kwh"}
              onClick={() => setMetric("kwh")}
            >
              kWh
            </Button>
            <Button
              variant="ghost"
              aria-pressed={metric === "annual"}
              onClick={() => setMetric("annual")}
            >
              Anual
            </Button>
          </div>
        </div>

        <div className="sim-kpi-grid">
          <div className="sim-kpi-box">
            <span className="tiny muted">Antes (original)</span>
            <b className="sim-kpi-val tabular-nums">{formatBrl(originalBrl)}</b>
            <small className="muted tabular-nums">
              {formatNumber(originalKwh, 1)} kWh/mês · {formatBrl(originalBrl * 12)}/ano
            </small>
          </div>

          <div className="sim-kpi-box is-after">
            <span className="tiny muted">Depois (simulado)</span>
            <b
              className={`sim-kpi-val tabular-nums ${
                isSaving ? "green" : isIncreasing ? "sim-red" : ""
              }`}
            >
              {formatBrl(simulatedBrl)}
            </b>
            <small className="muted tabular-nums">
              {formatNumber(simulatedKwh, 1)} kWh/mês · {formatBrl(simulatedBrl * 12)}/ano
            </small>
          </div>

          <div
            className={`sim-kpi-box ${
              isSaving ? "is-saving" : isIncreasing ? "is-increase" : ""
            }`}
          >
            <span className="tiny muted">
              {isSaving ? "Economia estimada" : isIncreasing ? "Aumento estimado" : "Diferença"}
            </span>
            <b
              className={`sim-kpi-val tabular-nums ${
                isSaving ? "green" : isIncreasing ? "sim-red" : ""
              }`}
            >
              {isSaving
                ? `-${formatBrl(deltaBrl)}`
                : isIncreasing
                  ? `+${formatBrl(Math.abs(deltaBrl))}`
                  : formatBrl(0)}
            </b>
            <small className="muted tabular-nums">
              {isSaving
                ? `${formatNumber(deltaPct, 1)}% menos · ${formatBrl(deltaAnnualBrl)}/ano`
                : isIncreasing
                  ? `${formatNumber(Math.abs(deltaPct), 1)}% mais · +${formatBrl(Math.abs(deltaAnnualBrl))}/ano`
                  : "Ajuste os controles abaixo"}
            </small>
          </div>
        </div>

        <div className="sim-global-bars" role="img" aria-label="Comparação visual de consumo original e simulado">
          <div className="sim-bar-row">
            <div className="sim-bar-meta">
              <span className="sim-bar-tag before">Antes</span>
              <b className="tabular-nums">
                {formatNumber(originalKwh, 1)} kWh · {formatBrl(originalBrl)}
              </b>
            </div>
            <div className="sim-bar-track">
              <div
                className="sim-bar-fill before"
                style={{ width: `${Math.max(4, (originalKwh / globalMax) * 100)}%` }}
              />
            </div>
          </div>

          <div className="sim-bar-row">
            <div className="sim-bar-meta">
              <span className="sim-bar-tag after">Depois</span>
              <b className={`tabular-nums ${isSaving ? "green" : isIncreasing ? "sim-red" : ""}`}>
                {formatNumber(simulatedKwh, 1)} kWh · {formatBrl(simulatedBrl)}
                {hasChanges && (
                  <span className="sim-inline-delta">
                    {" "}
                    ({isSaving ? `-${formatNumber(deltaPct, 1)}%` : `+${formatNumber(Math.abs(deltaPct), 1)}%`})
                  </span>
                )}
              </b>
            </div>
            <div className="sim-bar-track">
              <div
                className={`sim-bar-fill ${isIncreasing ? "increase" : "after"}`}
                style={{ width: `${Math.max(4, (simulatedKwh / globalMax) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="sim-preset-row">
          <span className="tiny muted">Cenários rápidos:</span>
          <div className="sim-preset-actions">
            <Button variant="outline" size="sm" onClick={() => applyPresetReduction(0.1)}>
              -10% uso
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPresetReduction(0.25)}>
              -25% uso
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPresetReduction(0.4)}>
              -40% uso
            </Button>
            {hasChanges && (
              <Button variant="ghost" size="sm" onClick={() => setSim({})}>
                <RotateCcw size={14} /> Restaurar
              </Button>
            )}
            {onExportPdf && (
              <Button className="btn sm primary" onClick={onExportPdf}>
                <FileDown size={15} /> Exportar PDF comparativo
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="simulator-charts-grid">
        <section className="card sim-chart-card">
          <div className="sim-chart-header">
            <div>
              <h3>Antes vs. Depois por aparelho</h3>
              <p className="tiny muted">Barras comparativas dos principais aparelhos</p>
            </div>
            {hasChanges && (
              <div className="chart-switch">
                <Button
                  variant="ghost"
                  aria-pressed={chartFilter === "all"}
                  onClick={() => setChartFilter("all")}
                >
                  Principais
                </Button>
                <Button
                  variant="ghost"
                  aria-pressed={chartFilter === "changed"}
                  onClick={() => setChartFilter("changed")}
                >
                  Alterados
                </Button>
              </div>
            )}
          </div>

          <div className="sim-chart-legend">
            <span>
              <i className="dot sim-dot-before" /> Antes (atual)
            </span>
            <span>
              <i className="dot sim-dot-after" /> Depois (simulado)
            </span>
          </div>

          <div className="sim-paired-list">
            {chartItems.map((item) => {
              const beforeVal =
                metric === "kwh"
                  ? item.origKwh
                  : metric === "annual"
                    ? item.origBrl * 12
                    : item.origBrl;
              const afterVal =
                metric === "kwh"
                  ? item.simKwh
                  : metric === "annual"
                    ? item.simBrl * 12
                    : item.simBrl;
              const pctChange =
                item.origKwh > 0 ? ((item.simKwh - item.origKwh) / item.origKwh) * 100 : 0;

              return (
                <div key={item.eq.id} className="sim-paired-row">
                  <div className="sim-paired-head">
                    <span className="ellipsis">{displayTitle(item.eq.name)}</span>
                    <span
                      className={`tabular-nums sim-paired-delta ${
                        pctChange < -0.5 ? "green" : pctChange > 0.5 ? "sim-red" : "muted"
                      }`}
                    >
                      {Math.abs(pctChange) < 0.5
                        ? "Sem alteração"
                        : `${pctChange > 0 ? "+" : ""}${formatNumber(pctChange, 0)}%`}
                    </span>
                  </div>

                  <div className="sim-paired-bars">
                    <div className="sim-paired-line">
                      <div className="sim-paired-track">
                        <div
                          className="sim-paired-fill before"
                          style={{ width: `${Math.max(3, (beforeVal / maxItemVal) * 100)}%` }}
                        />
                      </div>
                      <span className="sim-paired-val tabular-nums muted">
                        {formatMetric(item.origKwh, item.origBrl)}
                      </span>
                    </div>
                    <div className="sim-paired-line">
                      <div className="sim-paired-track">
                        <div
                          className={`sim-paired-fill ${
                            pctChange > 0.5 ? "increase" : "after"
                          }`}
                          style={{ width: `${Math.max(3, (afterVal / maxItemVal) * 100)}%` }}
                        />
                      </div>
                      <span
                        className={`sim-paired-val tabular-nums ${
                          pctChange < -0.5 ? "green" : pctChange > 0.5 ? "sim-red" : ""
                        }`}
                      >
                        {formatMetric(item.simKwh, item.simBrl)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card sim-chart-card">
          <div className="sim-chart-header">
            <div>
              <h3>Impacto por ambiente</h3>
              <p className="tiny muted">Antes vs. Depois em cada cômodo ou setor</p>
            </div>
          </div>

          <div className="sim-chart-legend">
            <span>
              <i className="dot sim-dot-before" /> Antes
            </span>
            <span>
              <i className="dot sim-dot-after" /> Depois
            </span>
          </div>

          <div className="sim-paired-list">
            {envComparison.map((row) => {
              const beforeVal =
                metric === "kwh"
                  ? row.origKwh
                  : metric === "annual"
                    ? row.origBrl * 12
                    : row.origBrl;
              const afterVal =
                metric === "kwh"
                  ? row.simKwh
                  : metric === "annual"
                    ? row.simBrl * 12
                    : row.simBrl;
              const pctChange =
                row.origKwh > 0 ? ((row.simKwh - row.origKwh) / row.origKwh) * 100 : 0;

              return (
                <div key={row.env.id} className="sim-paired-row">
                  <div className="sim-paired-head">
                    <span className="ellipsis">{row.env.name}</span>
                    <span
                      className={`tabular-nums sim-paired-delta ${
                        pctChange < -0.5 ? "green" : pctChange > 0.5 ? "sim-red" : "muted"
                      }`}
                    >
                      {Math.abs(pctChange) < 0.5
                        ? "Igual"
                        : `${pctChange > 0 ? "+" : ""}${formatNumber(pctChange, 0)}%`}
                    </span>
                  </div>
                  <div className="sim-paired-bars">
                    <div className="sim-paired-line">
                      <div className="sim-paired-track">
                        <div
                          className="sim-paired-fill before"
                          style={{ width: `${Math.max(3, (beforeVal / maxEnvVal) * 100)}%` }}
                        />
                      </div>
                      <span className="sim-paired-val tabular-nums muted">
                        {formatMetric(row.origKwh, row.origBrl)}
                      </span>
                    </div>
                    <div className="sim-paired-line">
                      <div className="sim-paired-track">
                        <div
                          className={`sim-paired-fill ${
                            pctChange > 0.5 ? "increase" : "after"
                          }`}
                          style={{ width: `${Math.max(3, (afterVal / maxEnvVal) * 100)}%` }}
                        />
                      </div>
                      <span
                        className={`sim-paired-val tabular-nums ${
                          pctChange < -0.5 ? "green" : pctChange > 0.5 ? "sim-red" : ""
                        }`}
                      >
                        {formatMetric(row.simKwh, row.simBrl)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <SectionTitle
        title="Ajustar por aparelho"
        action={hasChanges ? "Restaurar tudo" : "Restaurar"}
        onAction={() => setSim({})}
      />

      <div className="simulator-list-grid">
        {items.map((item) => {
          const { eq, origMin, simMin, origKwh, simKwh, origBrl, simBrl, deltaBrl: itemSaved, changed } = item;
          const detail = modelDetail(eq.name);
          const envName = project.environments.find((e) => e.id === eq.envId)?.name;
          const itemPct = origKwh > 0 ? ((simKwh - origKwh) / origKwh) * 100 : 0;
          const itemBarMax = Math.max(0.01, origKwh, simKwh);

          return (
            <div key={eq.id} className={`item simulation-item ${changed ? "is-modified" : ""}`}>
              <div className="simulation-heading">
                <div className="avatar g">
                  <AppIcon name={inferIconName(eq.name)} />
                </div>
                <div className="grow">
                  <div className="item-title">{displayTitle(eq.name)}</div>
                  {detail && <div className="model-detail">{detail}</div>}
                  <div className="item-sub">
                    {envName ? `${envName} · ` : ""}
                    {eq.qty}x · {formatNumber(eq.powerW, 0)} W
                  </div>
                </div>
                {changed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sim-reset-item"
                    title="Restaurar este aparelho"
                    aria-label={`Restaurar ${eq.name}`}
                    onClick={() => {
                      const next = { ...sim };
                      delete next[eq.id];
                      setSim(next);
                    }}
                  >
                    <RotateCcw size={15} />
                  </Button>
                )}
              </div>

              <div className="sim-item-compare tabular-nums">
                <div>
                  <span className="tiny muted">Antes</span>
                  <div>
                    <b>{formatNumber(origKwh, 1)} kWh</b> · {formatBrl(origBrl)}
                  </div>
                  <small className="muted">{formatDuration(origMin)}/dia</small>
                </div>
                <div className="sim-arrow" aria-hidden="true">
                  →
                </div>
                <div>
                  <span className="tiny muted">Depois</span>
                  <div className={itemSaved > 0.01 ? "green" : itemSaved < -0.01 ? "sim-red" : ""}>
                    <b>{formatNumber(simKwh, 1)} kWh</b> · {formatBrl(simBrl)}
                  </div>
                  <small className={itemSaved > 0.01 ? "green" : itemSaved < -0.01 ? "sim-red" : "muted"}>
                    {changed
                      ? `${itemSaved >= 0 ? "-" : "+"}${formatBrl(Math.abs(itemSaved))}/mês (${itemPct > 0 ? "+" : ""}${formatNumber(itemPct, 0)}%)`
                      : `${formatDuration(simMin)}/dia`}
                  </small>
                </div>
              </div>

              <div className="sim-item-minibars">
                <div className="sim-paired-track">
                  <div
                    className="sim-paired-fill before"
                    style={{ width: `${Math.max(3, (origKwh / itemBarMax) * 100)}%` }}
                  />
                </div>
                <div className="sim-paired-track">
                  <div
                    className={`sim-paired-fill ${itemPct > 0.5 ? "increase" : "after"}`}
                    style={{ width: `${Math.max(3, (simKwh / itemBarMax) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="simulation-controls">
                <span className="small muted">Minutos/dia</span>
                <div className="field">
                  <input
                    aria-label={`Minutos por dia — ${eq.name}`}
                    type="number"
                    min="0"
                    max="1440"
                    step="1"
                    value={Math.round(simMin * 10) / 10}
                    onChange={(e) =>
                      setSim({
                        ...sim,
                        [eq.id]: Math.max(0, Math.min(1440, Number(e.target.value))),
                      })
                    }
                  />
                </div>
                <span className="tiny muted tabular-nums">{formatDuration(simMin)}</span>
              </div>

              <Slider
                aria-label={`Ajustar tempo de uso — ${eq.name}`}
                min={0}
                max={1440}
                step={5}
                value={[simMin]}
                onValueChange={(vals) => setSim({ ...sim, [eq.id]: vals[0] ?? 0 })}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
