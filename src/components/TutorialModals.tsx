import { useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  FileDown,
  Home,
  PlugZap,
  Share,
  SlidersHorizontal,
  SquarePlus,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";

const TUTORIAL_STEPS = [
  {
    step: 1,
    icon: Home,
    title: "1. Crie sua instalação e tarifa",
    badge: "Início rápido",
    description:
      "Informe o nome do local (casa, comércio ou indústria), escolha o estado e a distribuidora para puxar a tarifa oficial ou digite o valor da sua conta de luz.",
    tips: [
      "Você pode incluir a bandeira tarifária ativa no cálculo.",
      "Cadastre quantas instalações diferentes desejar.",
    ],
  },
  {
    step: 2,
    icon: DoorOpen,
    title: "2. Adicione seus ambientes (até 99)",
    badge: "Aba Ambientes",
    description:
      "Organize o consumo por cômodos ou setores. Você pode criar de 1 até 99 ambientes iguais de uma única vez (ex.: Quartos, Salas, Galpões).",
    tips: [
      "Toque em qualquer ambiente para filtrar seus aparelhos.",
      "Cada ambiente mostra sua participação % no gasto mensal.",
    ],
  },
  {
    step: 3,
    icon: PlugZap,
    title: "3. Cadastre os aparelhos",
    badge: "Aba Aparelhos",
    description:
      "Busque na biblioteca com 4.998 aparelhos prontos ou cadastre manualmente informando potência (W), quantidade e horas de uso por dia.",
    tips: [
      "Use a rotina semanal se o aparelho liga em horários diferentes por dia.",
      "Os cálculos atualizam automaticamente em kWh e R$.",
    ],
  },
  {
    step: 4,
    icon: BarChart3,
    title: "4. Veja gráficos, simule e exporte PDF",
    badge: "Início • Simular • Ajustes",
    description:
      "No Início, acompanhe gráficos por categoria, semana, ambientes e aparelhos. Em Simular, teste reduzir o uso e compare Antes vs. Depois — depois salve tudo em PDF!",
    tips: [
      "A simulação mostra economia mensal e anual em tempo real.",
      "O PDF exportado já inclui gráficos e comparativo Antes vs. Depois.",
    ],
  },
] as const;

export function FirstUseTutorial({
  hasProject,
  onFinish,
  onCreateProject,
}: {
  hasProject: boolean;
  onFinish: () => void;
  onCreateProject: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const current = TUTORIAL_STEPS[idx] ?? TUTORIAL_STEPS[0];
  const Icon = current.icon;
  const isLast = idx === TUTORIAL_STEPS.length - 1;

  return (
    <div className="tutorial-flow">
      <div className="tutorial-progress" aria-label={`Passo ${idx + 1} de ${TUTORIAL_STEPS.length}`}>
        {TUTORIAL_STEPS.map((item, i) => (
          <button
            key={item.step}
            type="button"
            className={`tutorial-dot ${i === idx ? "active" : i < idx ? "done" : ""}`}
            aria-label={`Ir para passo ${item.step}`}
            onClick={() => setIdx(i)}
          />
        ))}
      </div>

      <div className="tutorial-card">
        <div className="tutorial-icon-wrap">
          <Icon size={28} />
        </div>
        <div className="tutorial-meta">
          <span className="tutorial-step-label">
            Passo {idx + 1} de {TUTORIAL_STEPS.length} · {current.badge}
          </span>
          <h3>{current.title}</h3>
        </div>
        <p className="tutorial-desc">{current.description}</p>
        <ul className="tutorial-tips">
          {current.tips.map((tip) => (
            <li key={tip}>
              <CheckCircle2 size={15} />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="tutorial-quick-legend">
        <span>
          <SlidersHorizontal size={14} /> Simular economia
        </span>
        <span>
          <FileDown size={14} /> PDF com gráficos
        </span>
      </div>

      <div className="sheet-actions">
        {idx === 0 ? (
          <Button className="btn ghost" onClick={onFinish}>
            Pular tutorial
          </Button>
        ) : (
          <Button className="btn ghost" onClick={() => setIdx((prev) => Math.max(0, prev - 1))}>
            <ChevronLeft size={16} /> Anterior
          </Button>
        )}

        {!isLast ? (
          <Button
            className="btn primary"
            onClick={() => setIdx((prev) => Math.min(TUTORIAL_STEPS.length - 1, prev + 1))}
          >
            Próximo <ChevronRight size={16} />
          </Button>
        ) : hasProject ? (
          <Button className="btn primary" onClick={onFinish}>
            Começar a usar
          </Button>
        ) : (
          <Button className="btn primary" onClick={onCreateProject}>
            Criar minha instalação
          </Button>
        )}
      </div>
    </div>
  );
}

export function IosInstallTutorial({ onClose }: { onClose: () => void }) {
  const isSafari =
    typeof navigator !== "undefined" &&
    /safari/i.test(navigator.userAgent) &&
    !/crios|fxios|edgios|opios/i.test(navigator.userAgent);

  return (
    <div className="ios-tutorial-wrap">
      {!isSafari && (
        <div className="ios-safari-alert">
          <b>Dica importante:</b> no iPhone/iPad, a instalação só aparece no navegador{" "}
          <b>Safari</b>. Se você abriu por outro app ou navegador, copie o link e abra no Safari.
        </div>
      )}

      <ol className="ios-steps">
        <li>
          <span>1</span>
          <div>
            <b>Abra no Safari</b>
            <p className="tiny muted">
              Certifique-se de estar visualizando o Consumo Consciente diretamente no Safari.
            </p>
          </div>
        </li>
        <li>
          <span>2</span>
          <div>
            <b className="inline-flex items-center gap-1.5">
              Toque em Compartilhar <Share size={15} className="yellow" />
            </b>
            <p className="tiny muted">
              Ícone de quadrado com seta para cima na barra inferior (iPhone) ou superior (iPad).
            </p>
          </div>
        </li>
        <li>
          <span>3</span>
          <div>
            <b className="inline-flex items-center gap-1.5">
              Escolha Adicionar à Tela de Início <SquarePlus size={15} className="yellow" />
            </b>
            <p className="tiny muted">Role a lista de ações para baixo até encontrar essa opção.</p>
          </div>
        </li>
        <li>
          <span>4</span>
          <div>
            <b>Toque em Adicionar</b>
            <p className="tiny muted">
              No canto superior direito. O aplicativo ficará na sua tela inicial e funcionará offline.
            </p>
          </div>
        </li>
      </ol>

      <div className="sheet-actions">
        <Button className="btn primary" onClick={onClose}>
          Entendi
        </Button>
      </div>
    </div>
  );
}
