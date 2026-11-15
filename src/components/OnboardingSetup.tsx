import { useState } from "react";
import { AppIcon } from "@/src/components/AppIcon";
import { Button } from "@/src/components/ui/button";
import { EXAMPLE_ROOMS, roomPresets } from "@/src/lib/energy";
import type { Project, ProjectType } from "@/src/types/energy";

export function RoomPicker({
  type,
  onAdd,
}: {
  type: ProjectType;
  onAdd: (template: { name: string; icon: string }, count: number) => void;
}) {
  const [selected, setSelected] = useState<{ name: string; icon: string } | null>(null);
  const [countText, setCountText] = useState("1");
  const [customName, setCustomName] = useState("");
  const [isCustom, setIsCustom] = useState(false);

  const count = Math.min(99, Math.max(1, Math.floor(Number(countText) || 1)));
  const label = isCustom ? customName.trim() : (selected?.name ?? "");

  if (!selected && !isCustom) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {roomPresets(type).map((room) => (
          <Button
            key={room.name}
            variant="outline"
            className="min-h-14 justify-start gap-2"
            onClick={() => {
              setSelected(room);
              setCountText("1");
            }}
          >
            <AppIcon name={room.icon} />
            {room.name}
          </Button>
        ))}
        <Button
          variant="outline"
          className="min-h-14 justify-start gap-2"
          onClick={() => {
            setIsCustom(true);
            setCountText("1");
          }}
        >
          <AppIcon name="add" />
          Outro ambiente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        className="gap-2"
        onClick={() => {
          setSelected(null);
          setIsCustom(false);
        }}
      >
        <AppIcon name="arrow_back" />
        Escolher outro ambiente
      </Button>

      {isCustom ? (
        <label className="field">
          <span>Nome do ambiente</span>
          <input
            autoFocus
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Ex.: Depósito"
          />
        </label>
      ) : (
        <h3 className="flex items-center gap-2">
          <AppIcon name={selected?.icon ?? "meeting_room"} />
          {label}
        </h3>
      )}

      <label className="field">
        <span>Quantidade de {label || "ambientes"} (1 a 99)</span>
        <input
          aria-label={`Quantidade de ${label || "ambientes"}`}
          type="number"
          min="1"
          max="99"
          value={countText}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              setCountText("");
              return;
            }
            const parsed = Math.floor(Number(raw));
            if (Number.isFinite(parsed)) {
              setCountText(String(Math.min(99, Math.max(0, parsed))));
            }
          }}
          onBlur={() => setCountText(String(count))}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 10, 20, 50, 99].map((n) => (
          <Button
            key={n}
            variant={count === n ? "default" : "outline"}
            aria-label={`${n} ${label || "ambientes"}`}
            aria-pressed={count === n}
            onClick={() => setCountText(String(n))}
          >
            {n}
          </Button>
        ))}
      </div>

      <p className="small muted">
        {count === 1
          ? label
          : count <= 4
            ? Array.from({ length: count }, (_, idx) => `${label} ${idx + 1}`).join(" · ")
            : `${label} 1 · ${label} 2 · ${label} 3 … ${label} ${count}`}
      </p>

      <Button
        className="btn primary block"
        disabled={!label}
        onClick={() => {
          onAdd({ name: label, icon: selected?.icon ?? "meeting_room" }, count);
          setSelected(null);
          setIsCustom(false);
          setCustomName("");
          setCountText("1");
        }}
      >
        Criar {count === 1 ? label : `${count} ambientes`}
      </Button>
    </div>
  );
}

export function SetupFlow({
  project,
  onAddRoom,
  onContinue,
  onAppliance,
  onFinish,
}: {
  project: Project;
  onAddRoom: (template: { name: string; icon: string }, count: number) => void;
  onCustomRoom?: () => void;
  onContinue: () => void;
  onAppliance: (envId: string) => void;
  onFinish: () => void;
}) {
  const isRoomsStage = project.setupStage === "rooms";

  return (
    <section className="space-y-5 py-3">
      <ol aria-label="Etapas do cadastro" className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        {["Local", "Ambientes", "Aparelhos"].map((step, idx) => (
          <li
            key={step}
            aria-current={(isRoomsStage ? 1 : 2) === idx ? "step" : undefined}
            className={(isRoomsStage ? 1 : 2) === idx ? "text-primary font-semibold" : ""}
          >
            {idx === 0 ? "✓" : idx + 1} · {step}
          </li>
        ))}
      </ol>

      <div>
        <h2>{isRoomsStage ? "Quais ambientes existem aqui?" : "O que você usa em cada ambiente?"}</h2>
        <p className="small muted mt-2">
          {isRoomsStage ? project.name : "Cada aparelho fica vinculado ao seu ambiente."}
        </p>
      </div>

      {isRoomsStage && <RoomPicker type={project.type} onAdd={onAddRoom} />}

      <div className="list">
        {project.environments.map((env) => (
          <div key={env.id}>
            <div className="item">
              <div className="avatar">
                <AppIcon name={env.icon} />
              </div>
              <div className="grow">
                <b>{env.name}</b>
                <div className="small muted">
                  {project.equipments.filter((eq) => eq.envId === env.id).length} aparelhos
                </div>
              </div>
              {!isRoomsStage && (
                <Button
                  variant="outline"
                  aria-label={`Adicionar aparelho em ${env.name}`}
                  onClick={() => onAppliance(env.id)}
                >
                  <AppIcon name="add" />
                  Adicionar
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button
        className="btn primary block"
        disabled={isRoomsStage ? !project.environments.length : !project.equipments.length}
        onClick={isRoomsStage ? onContinue : onFinish}
      >
        {isRoomsStage ? "Ambientes prontos · continuar" : "Ver meu consumo"}
      </Button>
    </section>
  );
}

export function ExamplePreview({ onStart }: { onStart: () => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const current = EXAMPLE_ROOMS[selectedIdx];

  return (
    <div className="space-y-5">
      <ol className="space-y-2 small">
        <li>1 · Minha casa — local e tarifa de energia</li>
        <li>2 · Quarto, cozinha e sala — ambientes</li>
        <li>3 · Aparelhos — consumo em cada ambiente</li>
      </ol>

      <div className="grid grid-cols-3 gap-2">
        {EXAMPLE_ROOMS.map((room, idx) => (
          <Button
            key={room.name}
            variant={selectedIdx === idx ? "default" : "outline"}
            className="flex-col gap-2 h-auto py-3"
            aria-pressed={selectedIdx === idx}
            onClick={() => setSelectedIdx(idx)}
          >
            <AppIcon name={room.icon} />
            {room.name}
          </Button>
        ))}
      </div>

      <div className="list">
        {current?.appliances.map((app) => (
          <div key={app} className="item">
            <AppIcon name="electrical_services" />
            <div className="grow">
              <b>{app}</b>
              <div className="small muted">{current.name}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="tiny muted">Exemplo ilustrativo. Nada foi adicionado aos seus dados.</p>

      <Button className="btn primary block" onClick={onStart}>
        Cadastrar meu local
      </Button>
    </div>
  );
}
