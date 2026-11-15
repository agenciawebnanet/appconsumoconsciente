import {
  BarChart3,
  Check,
  DoorOpen,
  Home,
  PlugZap,
  Share,
  SlidersHorizontal,
  SquarePlus,
  X,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import type { Project, TabId } from "@/src/types/energy";

export function InteractiveTutorialCard({
  project,
  currentTab,
  hasSimChanges,
  onCreateProject,
  onAddEnvironment,
  onAddEquipment,
  onGoHome,
  onGoSimulate,
  onDismiss,
}: {
  project: Project | undefined;
  currentTab: TabId;
  hasSimChanges: boolean;
  onCreateProject: () => void;
  onAddEnvironment: () => void;
  onAddEquipment: () => void;
  onGoHome: () => void;
  onGoSimulate: () => void;
  onDismiss: () => void;
}) {
  const step1Done = Boolean(project);
  const step2Done = Boolean(project && project.environments.length > 0);
  const step3Done = Boolean(project && project.equipments.length > 0);
  const step4Done = Boolean(step3Done && hasSimChanges);

  const activeStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4;

  const steps = [
    { num: 1, label: "Instalação", done: step1Done, icon: Home, onClick: onCreateProject },
    {
      num: 2,
      label: "Ambientes",
      done: step2Done,
      icon: DoorOpen,
      onClick: step1Done ? onAddEnvironment : onCreateProject,
    },
    {
      num: 3,
      label: "Aparelhos",
      done: step3Done,
      icon: PlugZap,
      onClick: step2Done ? onAddEquipment : step1Done ? onAddEnvironment : onCreateProject,
    },
    {
      num: 4,
      label: "Gráficos & Simular",
      done: step4Done,
      icon: BarChart3,
      onClick: onGoSimulate,
    },
  ] as const;

  return (
    <section className="live-tutorial-card" aria-label="Guia interativo passo a passo">
      <div className="live-tutorial-header">
        <div>
          <span className="tutorial-step-label">
            Guia interativo · Etapa {activeStep} de 4
          </span>
          <h2>
            {activeStep === 1 && "Crie sua primeira instalação"}
            {activeStep === 2 && "Agora adicione os ambientes"}
            {activeStep === 3 && "Cadastre um aparelho real"}
            {activeStep === 4 &&
              (step4Done
                ? "Tudo pronto! Simulação testada"
                : "Explore seus gráficos e simule economia")}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="live-tutorial-close"
          aria-label="Fechar guia interativo"
          title="Fechar guia"
          onClick={onDismiss}
        >
          <X size={16} />
        </Button>
      </div>

      <div className="live-tutorial-steps">
        {steps.map((s) => {
          const Icon = s.icon;
          const isCurrent = activeStep === s.num;
          return (
            <button
              key={s.num}
              type="button"
              onClick={s.onClick}
              className={`live-step-pill ${s.done ? "done" : ""} ${isCurrent ? "current" : ""}`}
            >
              <span className="live-step-badge">
                {s.done ? <Check size={12} /> : <Icon size={12} />}
              </span>
              <span className="live-step-text">{s.label}</span>
            </button>
          );
        })}
      </div>

      <p className="live-tutorial-desc">
        {activeStep === 1 &&
          "Informe o nome do local (casa, loja ou empresa), estado e tarifa de energia para iniciar os cálculos reais."}
        {activeStep === 2 &&
          `Instalação "${project?.name}" criada! Agora cadastre seus cômodos ou setores (você pode criar de 1 até 99 de uma vez).`}
        {activeStep === 3 &&
          `${project?.environments.length} ambiente(s) pronto(s)! Escolha um aparelho da biblioteca com 4.998 itens ou cadastre manualmente.`}
        {activeStep === 4 &&
          (step4Done
            ? "Você já cadastrou instalação, ambientes, aparelhos e simulou economia Antes vs. Depois. Agora você pode exportar o PDF completo ou continuar ajustando!"
            : "Seus cálculos e gráficos já estão ativos com base nos itens reais! Teste reduzir minutos na aba Simular para ver o comparativo Antes vs. Depois.")}
      </p>

      <div className="live-tutorial-actions">
        {activeStep === 1 && (
          <Button className="btn sm primary" onClick={onCreateProject}>
            <Home size={15} /> Criar instalação agora
          </Button>
        )}
        {activeStep === 2 && (
          <Button className="btn sm primary" onClick={onAddEnvironment}>
            <DoorOpen size={15} /> Adicionar ambiente(s)
          </Button>
        )}
        {activeStep === 3 && (
          <Button className="btn sm primary" onClick={onAddEquipment}>
            <PlugZap size={15} /> Adicionar aparelho
          </Button>
        )}
        {activeStep === 4 && (
          <>
            {currentTab !== "home" && (
              <Button className="btn sm ghost" onClick={onGoHome}>
                <BarChart3 size={15} /> Ver gráficos no Início
              </Button>
            )}
            {currentTab !== "simulate" && (
              <Button className="btn sm primary" onClick={onGoSimulate}>
                <SlidersHorizontal size={15} /> Testar Simular (Antes vs. Depois)
              </Button>
            )}
            {(step4Done || currentTab === "simulate") && (
              <Button className="btn sm primary" onClick={onDismiss}>
                <Check size={15} /> Concluir guia
              </Button>
            )}
          </>
        )}

        {activeStep < 4 && (
          <Button variant="ghost" className="btn sm ghost" onClick={onDismiss}>
            Pular guia
          </Button>
        )}
      </div>
    </section>
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
