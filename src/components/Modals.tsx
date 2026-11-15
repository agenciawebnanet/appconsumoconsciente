import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { AppIcon } from "@/src/components/AppIcon";
import { Field, PrimaryButton } from "@/src/components/SharedPrimitives";
import { TariffPanel, type ProjectDraft } from "@/src/components/TariffPanel";
import { Button } from "@/src/components/ui/button";
import {
  calcKwh,
  createId,
  effectiveTariff,
  formatBrl,
  formatDuration,
  formatNumber,
  PROJECT_TYPES,
  ROOM_ICON_LABELS,
  ROOM_ICONS,
} from "@/src/lib/energy";
import type {
  CatalogAppliance,
  Environment,
  Equipment,
  Project,
  ProjectType,
} from "@/src/types/energy";

export function SheetModal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="modal-root open">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-heading">
          <h2>{title}</h2>
          <Button
            variant="ghost"
            className="sheet-close"
            aria-label="Fechar janela"
            onClick={onClose}
          >
            <X size={18} />
          </Button>
        </div>
        <p className="sub">{description}</p>
        {children}
      </div>
    </div>
  );
}

export function ProjectForm({
  existing,
  onSave,
  onCancel,
}: {
  existing?: Project;
  onSave: (data: ProjectDraft) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ProjectDraft>(
    existing ?? {
      name: "",
      type: "RESIDENTIAL",
      tariff: 0.75,
      days: 30,
      state: "",
      utility: "",
    }
  );

  return (
    <>
      <Field label="Nome">
        <input
          autoFocus
          placeholder="Casa, loja, fábrica…"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Tipo">
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as ProjectType })}
        >
          {PROJECT_TYPES.map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <TariffPanel value={form} onChange={setForm} />
      <Field label="Dias no mês">
        <input
          type="number"
          min="1"
          max="31"
          value={form.days}
          onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
        />
      </Field>
      <div className="sheet-actions">
        <PrimaryButton ghost onClick={onCancel}>
          Cancelar
        </PrimaryButton>
        <PrimaryButton
          onClick={() =>
            onSave({
              ...form,
              name: form.name.trim() || "Minha instalação",
              days: Math.min(31, Math.max(1, form.days || 30)),
            })
          }
        >
          Salvar
        </PrimaryButton>
      </div>
    </>
  );
}

export function EnvironmentForm({
  existing,
  onSave,
  onDelete,
}: {
  existing?: Environment;
  onSave: (env: Environment) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "meeting_room");

  return (
    <>
      <Field label="Nome">
        <input
          autoFocus
          placeholder="Quarto 01"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <label className="tiny muted">Ícone</label>
      <div className="chips my-3">
        {ROOM_ICONS.map((iconName, idx) => (
          <Button
            key={iconName}
            className={`chip ${icon === iconName ? "active" : ""}`}
            title={ROOM_ICON_LABELS[idx]}
            aria-label={ROOM_ICON_LABELS[idx]}
            aria-pressed={icon === iconName}
            onClick={() => setIcon(iconName)}
          >
            <AppIcon name={iconName} />
          </Button>
        ))}
      </div>
      <div className="sheet-actions">
        {existing && onDelete && (
          <Button className="btn danger" onClick={onDelete}>
            Excluir
          </Button>
        )}
        <PrimaryButton
          onClick={() => {
            if (name.trim()) {
              onSave({
                id: existing?.id ?? createId(),
                name: name.trim(),
                icon,
              });
            }
          }}
        >
          Salvar
        </PrimaryButton>
      </div>
    </>
  );
}

const WEEK_DAYS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function EquipmentForm({
  project,
  existing,
  chosen,
  envId,
  onSave,
  onDelete,
}: {
  project: Project;
  existing?: Equipment;
  chosen?: CatalogAppliance;
  envId?: string;
  onSave: (eq: Equipment) => void;
  onDelete?: () => void;
}) {
  const [form, setForm] = useState<Equipment>(
    existing ?? {
      id: createId(),
      name: chosen?.name ?? "",
      category: chosen?.category ?? "Outros",
      powerW: chosen?.powerW ?? 100,
      qty: 1,
      hours: chosen?.hours ?? 8,
      days: chosen?.days ?? project.days,
      factor: chosen?.factor ?? 1,
      envId: envId || project.environments[0]?.id || "",
    }
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useWeekly, setUseWeekly] = useState(!!existing?.weeklyMinutes);
  const [weeklyMinutes, setWeeklyMinutes] = useState<number[]>(
    existing?.weeklyMinutes ?? Array(7).fill(form.hours * 60)
  );

  const updateField = (key: keyof Equipment, raw: string) => {
    const numericKeys: (keyof Equipment)[] = ["powerW", "qty", "days", "factor"];
    setForm({
      ...form,
      [key]: numericKeys.includes(key) ? Number(raw) : raw,
    });
  };

  const previewEquipment: Equipment = {
    ...form,
    weeklyMinutes: useWeekly ? weeklyMinutes : null,
  };

  return (
    <>
      <Field label="Nome">
        <input
          autoFocus
          placeholder="Ar-condicionado"
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
        />
      </Field>

      <div className="grid2">
        <Field label="Categoria">
          <input
            value={form.category}
            onChange={(e) => updateField("category", e.target.value)}
          />
        </Field>
        <Field label="Ambiente">
          <select
            value={form.envId}
            onChange={(e) => updateField("envId", e.target.value)}
          >
            {!project.environments.length && <option value="">Crie um ambiente</option>}
            {project.environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid2">
        <div hidden={!!chosen && !showAdvanced}>
          <Field label="Potência (W)">
            <input
              type="number"
              value={form.powerW}
              onChange={(e) => updateField("powerW", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Quantidade">
          <input
            type="number"
            min="1"
            value={form.qty}
            onChange={(e) => updateField("qty", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid2">
        <Field label="Horas por dia">
          <input
            type="number"
            min="0"
            max="24"
            step="0.25"
            disabled={useWeekly}
            value={Number(form.hours.toFixed(2))}
            onChange={(e) =>
              setForm({
                ...form,
                hours: Math.min(24, Math.max(0, Number(e.target.value))),
              })
            }
          />
        </Field>
        <Field label="Dias no mês">
          <input
            type="number"
            min="1"
            max="31"
            value={form.days}
            onChange={(e) => updateField("days", e.target.value)}
          />
        </Field>
      </div>

      <Button
        variant="ghost"
        className="advanced-toggle"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? "Menos opções" : "Ajustar potência e rotina semanal"}
      </Button>

      <div hidden={!showAdvanced}>
        <label className="row spread my-3">
          <span>
            <span className="item-title text-sm">Rotina por dia da semana</span>
            <span className="item-sub block">Ex.: 3h na terça, 4h no domingo, 0h no sábado.</span>
          </span>
          <input
            className="size-5 accent-primary"
            type="checkbox"
            checked={useWeekly}
            onChange={(e) => setUseWeekly(e.target.checked)}
          />
        </label>

        {useWeekly && (
          <div className="space-y-2 mb-3">
            {WEEK_DAYS_SHORT.map((day, idx) => (
              <div key={day} className="row">
                <span className="tiny muted w-8">{day}</span>
                <Field label={`${day} — minutos`}>
                  <input
                    type="number"
                    min="0"
                    max="1440"
                    value={weeklyMinutes[idx]}
                    onChange={(e) =>
                      setWeeklyMinutes(
                        weeklyMinutes.map((val, i) =>
                          i === idx ? Math.min(1440, Math.max(0, Number(e.target.value))) : val
                        )
                      )
                    }
                  />
                </Field>
                <span className="tiny muted">{formatDuration(weeklyMinutes[idx] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}

        <Field label="Fator médio de uso (0–1)">
          <input
            type="number"
            min="0"
            max="1"
            step="0.05"
            disabled={useWeekly}
            value={form.factor}
            onChange={(e) => updateField("factor", e.target.value)}
          />
        </Field>
      </div>

      <p className="usage-preview">
        {formatNumber(calcKwh(previewEquipment))} kWh/mês •{" "}
        {formatBrl(calcKwh(previewEquipment) * effectiveTariff(project))} •{" "}
        {formatDuration(
          useWeekly ? weeklyMinutes.reduce((acc, m) => acc + m, 0) : form.hours * 60
        )}
        /{useWeekly ? "semana" : "dia"}
      </p>

      <div className="sheet-actions">
        {existing && onDelete && (
          <Button className="btn danger" onClick={onDelete}>
            Excluir
          </Button>
        )}
        <PrimaryButton
          disabled={!form.name.trim() || form.powerW <= 0 || !form.envId}
          onClick={() =>
            onSave({
              ...previewEquipment,
              name: form.name.trim() || "Aparelho",
              qty: Math.max(1, Math.round(form.qty) || 1),
              days: Math.min(31, Math.max(1, form.days || 30)),
              factor: Math.min(1, Math.max(0, form.factor)),
              hours: useWeekly
                ? weeklyMinutes.reduce((acc, m) => acc + m, 0) / 7 / 60
                : form.hours,
            })
          }
        >
          Salvar
        </PrimaryButton>
      </div>
    </>
  );
}
