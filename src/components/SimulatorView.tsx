import { AppIcon } from "@/src/components/AppIcon";
import { SectionTitle } from "@/src/components/SharedPrimitives";
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

export function SimulatorView({
  project,
  sim,
  setSim,
}: {
  project: Project;
  sim: Record<string, number>;
  setSim: (next: Record<string, number>) => void;
}) {
  const originalKwh = project.equipments.reduce((acc, eq) => acc + calcKwh(eq), 0);
  const simulatedKwh = project.equipments.reduce(
    (acc, eq) => acc + simulateKwh(eq, sim[eq.id] ?? avgDailyMinutes(eq)),
    0
  );
  const savingsBrl = (originalKwh - simulatedKwh) * effectiveTariff(project);

  return (
    <>
      <div className="card hero">
        <div className="tiny muted">
          {savingsBrl > 0.005 ? "Economia potencial" : "Custo atual"}
        </div>
        <div className={`text-[26px] font-extrabold ${savingsBrl > 0.005 ? "green" : ""}`}>
          {formatBrl(savingsBrl > 0.005 ? savingsBrl : originalKwh * effectiveTariff(project))}
        </div>
        <div className="tiny muted">
          {savingsBrl > 0.005
            ? `${formatNumber(((originalKwh - simulatedKwh) / originalKwh) * 100, 1)}% menos consumo`
            : "por mês, com o uso atual"}
        </div>

        <div className="row spread small mt-4">
          <span>Original</span>
          <b>{formatNumber(originalKwh)} kWh</b>
        </div>
        <div className="bar original">
          <i className="w-full" />
        </div>

        <div className="row spread small mt-3">
          <span>Simulado</span>
          <b>{formatNumber(simulatedKwh)} kWh</b>
        </div>
        <div className="bar g">
          <i style={{ width: `${Math.min(100, (simulatedKwh / (originalKwh || 1)) * 100)}%` }} />
        </div>
      </div>

      <SectionTitle title="Ajustar por aparelho" action="Restaurar" onAction={() => setSim({})} />

      <div className="list">
        {project.equipments.map((eq) => {
          const minutes = sim[eq.id] ?? avgDailyMinutes(eq);
          const detail = modelDetail(eq.name);
          return (
            <div key={eq.id} className="item simulation-item">
              <div className="simulation-heading">
                <div className="avatar g">
                  <AppIcon name={inferIconName(eq.name)} />
                </div>
                <div className="grow">
                  <div className="item-title">{displayTitle(eq.name)}</div>
                  {detail && <div className="model-detail">{detail}</div>}
                  <div className="item-sub">
                    {eq.qty}x • {formatNumber(eq.powerW)} W
                  </div>
                </div>
                <div className="item-end green">
                  {formatNumber(simulateKwh(eq, minutes))} kWh
                </div>
              </div>

              <div className="simulation-controls">
                <span className="small muted">Minutos por dia</span>
                <div className="field">
                  <input
                    aria-label={`Minutos por dia — ${eq.name}`}
                    type="number"
                    min="0"
                    max="1440"
                    step="0.1"
                    value={minutes}
                    onChange={(e) =>
                      setSim({
                        ...sim,
                        [eq.id]: Math.max(0, Math.min(1440, Number(e.target.value))),
                      })
                    }
                  />
                </div>
                <span className="tiny muted shrink-0">{formatDuration(minutes)}</span>
              </div>

              <Slider
                aria-label={`Ajustar tempo de uso — ${eq.name}`}
                min={0}
                max={1440}
                step={5}
                value={[minutes]}
                onValueChange={(vals) => setSim({ ...sim, [eq.id]: vals[0] ?? 0 })}
              />
            </div>
          );
        })}
      </div>
    </>
  );
}
