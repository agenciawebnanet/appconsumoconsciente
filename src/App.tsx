import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { AppIcon } from "@/src/components/AppIcon";
import { CatalogPicker } from "@/src/components/CatalogPicker";
import { ConsumptionRing } from "@/src/components/ConsumptionRing";
import {
  EnvironmentForm,
  EquipmentForm,
  ProjectForm,
  SheetModal,
} from "@/src/components/Modals";
import { ExamplePreview, RoomPicker, SetupFlow } from "@/src/components/OnboardingSetup";
import {
  EmptyState,
  EquipmentRow,
  PrimaryButton,
  SectionTitle,
  SettingsActionRow,
} from "@/src/components/SharedPrimitives";
import { SimulatorView } from "@/src/components/SimulatorView";
import { Button } from "@/src/components/ui/button";
import { UsageChart } from "@/src/components/UsageChart";
import {
  calcKwh,
  createId,
  createProject,
  effectiveTariff,
  emptyStore,
  expandRooms,
  formatBrl,
  formatNumber,
  hasValidEnv,
  projectTypeLabel,
  TABS,
} from "@/src/lib/energy";
import { downloadBlob, generatePdfReport, saveOrShareBlob } from "@/src/lib/pdf";
import type { ModalState, Project, StoreState, TabId } from "@/src/types/energy";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const queryClient = new QueryClient();

function ConsumoApp() {
  const [store, setStore] = useState<StoreState>(emptyStore);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<TabId>("home");
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedEnvFilter, setSelectedEnvFilter] = useState("");
  const [sim, setSim] = useState<Record<string, number>>({});
  const [showInstallBanner, setShowInstallBanner] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [toast, setToast] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("cc_web_v2");
      if (raw) {
        const parsed = JSON.parse(raw) as StoreState;
        if (Array.isArray(parsed.projects)) {
          setStore(parsed);
        }
      }
    } catch {
      // ignore invalid stored state
    }

    setHydrated(true);
    setIsOffline(!navigator.onLine);

    const handleConnection = () => setIsOffline(!navigator.onLine);
    const handleOfflineReady = () => setIsOfflineReady(true);

    window.addEventListener("online", handleConnection);
    window.addEventListener("offline", handleConnection);
    window.addEventListener("consumo-offline-ready", handleOfflineReady);

    setIsIos(
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.userAgent.includes("Mac") && "ontouchend" in document)
    );
    setIsStandalone(
      matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    );

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };
    const handleInstalled = () => {
      setIsStandalone(true);
      setShowInstallBanner(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("online", handleConnection);
      window.removeEventListener("offline", handleConnection);
      window.removeEventListener("consumo-offline-ready", handleOfflineReady);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem("cc_web_v2", JSON.stringify(store));
      } catch {
        setToast("Não foi possível salvar.");
      }
    }
  }, [hydrated, store]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const currentProject = store.projects.find((p) => p.id === store.currentId);
  const totalKwh = currentProject?.equipments.reduce((acc, eq) => acc + calcKwh(eq), 0) ?? 0;
  const totalCost = totalKwh * (currentProject ? effectiveTariff(currentProject) : 0);

  const closeModal = () => setModal(null);

  const updateProject = (nextProject: Project) =>
    setStore((prev) => ({
      ...prev,
      projects: prev.projects.map((p) => (p.id === nextProject.id ? nextProject : p)),
    }));

  const handleInstall = async () => {
    if (isIos) {
      setModal({ type: "install" });
      return;
    }
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setShowInstallBanner(false);
        }
        setInstallPrompt(null);
      } catch {
        setToast("A instalação não pôde ser iniciada. Tente novamente.");
      }
    } else {
      setToast("A instalação fica disponível no endereço publicado quando o navegador permitir.");
    }
  };

  const navigateTab = (nextTab: TabId) => {
    closeModal();
    setTab(nextTab);
    window.scrollTo({ top: 0 });
  };

  const summaryText = currentProject
    ? `⚡ RELATÓRIO CONSUMO CONSCIENTE\n\n🏠 Projeto: ${currentProject.name}\nTarifa: ${formatBrl(
        effectiveTariff(currentProject)
      )}/kWh\nConsumo total: ${formatNumber(totalKwh)} kWh\nCusto estimado: ${formatBrl(
        totalCost
      )}\n\n${currentProject.equipments
        .map(
          (eq) =>
            `${eq.name} (${
              currentProject.environments.find((env) => env.id === eq.envId)?.name ?? "Sem ambiente"
            }) — ${formatNumber(calcKwh(eq))} kWh • ${formatBrl(
              calcKwh(eq) * effectiveTariff(currentProject)
            )}`
        )
        .join("\n")}\n\nValores estimados; podem diferir da fatura real.`
    : "";

  useEffect(() => {
    if (!currentProject) {
      setPdfBlob(null);
      return;
    }
    try {
      setPdfBlob(generatePdfReport(currentProject));
    } catch {
      setPdfBlob(null);
    }
  }, [currentProject]);

  const handleSavePdf = () => {
    if (!currentProject || !pdfBlob) {
      setToast("O relatório ainda não está pronto. Tente novamente.");
      return;
    }
    saveOrShareBlob(
      pdfBlob,
      `consumo-consciente-${currentProject.name.replace(/[^a-z0-9]+/gi, "-")}.pdf`
    ).catch(() => setToast("Não foi possível salvar o PDF. Tente novamente."));
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setToast("Resumo copiado.");
    } catch {
      setModal({ type: "summary" });
    }
  };

  const handleExportCsv = () => {
    if (!currentProject) return;
    const rows = [
      ["Equipamento", "Ambiente", "Categoria", "W", "Qtd", "Horas/dia", "Dias", "Fator", "kWh", "Custo"],
      ...currentProject.equipments.map((eq) => [
        eq.name,
        currentProject.environments.find((env) => env.id === eq.envId)?.name,
        eq.category,
        eq.powerW,
        eq.qty,
        eq.hours,
        eq.days,
        eq.factor,
        calcKwh(eq),
        calcKwh(eq) * effectiveTariff(currentProject),
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((row) =>
          row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")
        )
        .join("\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `consumo-consciente-${currentProject.name}.csv`
    );
  };

  const headerTitle = currentProject
    ? tab === "home"
      ? "Resumo"
      : tab === "simulate"
        ? "Economize energia"
        : TABS.find((item) => item[0] === tab)?.[1]
    : "Consumo Consciente";

  const headerSubtitle = currentProject
    ? tab === "environments"
      ? `${currentProject.environments.length} cadastrados`
      : tab === "equipment"
        ? `${currentProject.equipments.length} cadastrados`
        : tab === "simulate"
          ? "Ajuste o tempo de uso"
          : currentProject.name
    : "Comece criando sua instalação";

  if (!hydrated) {
    return <div className="app" />;
  }

  const filteredEquipments = currentProject
    ? currentProject.equipments.filter(
        (eq) =>
          (!selectedEnvFilter || eq.envId === selectedEnvFilter) &&
          eq.name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9 ]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .includes(
              searchQuery
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9 ]+/g, " ")
                .replace(/\s+/g, " ")
                .trim()
            )
      )
    : [];

  return (
    <>
      <div className="app">
        <header className="topbar">
          <div className="topbar-title">
            <h1>{headerTitle}</h1>
            <p>{headerSubtitle}</p>
          </div>
          {!isStandalone && (isIos || installPrompt) && (
            <Button
              className="icon-btn"
              title="Instalar aplicativo"
              aria-label="Instalar aplicativo"
              onClick={handleInstall}
            >
              <AppIcon name="download" />
            </Button>
          )}
        </header>

        <main className="view">
          {isOffline && (
            <div className="connection-status" role="status">
              <AppIcon name="bolt" />
              Sem conexão · dados neste aparelho
            </div>
          )}
          {isOfflineReady && !isOffline && (
            <div className="connection-status">Disponível offline</div>
          )}

          {currentProject ? (
            <div key={tab} className="view-content">
              {tab === "home" &&
              currentProject.setupStage &&
              currentProject.setupStage !== "done" ? (
                <SetupFlow
                  project={currentProject}
                  onAddRoom={(template, count) =>
                    updateProject({
                      ...currentProject,
                      environments: [
                        ...currentProject.environments,
                        ...expandRooms(currentProject.environments, template, count, createId),
                      ],
                    })
                  }
                  onCustomRoom={() => setModal({ type: "environment" })}
                  onContinue={() =>
                    updateProject({ ...currentProject, setupStage: "equipment" })
                  }
                  onAppliance={(envId) => setModal({ type: "catalog", envId })}
                  onFinish={() => updateProject({ ...currentProject, setupStage: "done" })}
                />
              ) : (
                tab === "home" &&
                (currentProject.equipments.length === 0 ? (
                  <EmptyState
                    hero
                    icon="add"
                    title="Adicione seu primeiro aparelho"
                    text={
                      currentProject.environments.length
                        ? "Escolha um equipamento na biblioteca e informe o tempo de uso."
                        : "Crie um ambiente (quarto, sala, cozinha) e depois adicione os aparelhos."
                    }
                    action={
                      currentProject.environments.length
                        ? "Adicionar aparelho"
                        : "Criar ambiente"
                    }
                    onAction={() =>
                      setModal(
                        currentProject.environments.length
                          ? { type: "catalog", envId: currentProject.environments[0]?.id }
                          : { type: "environment" }
                      )
                    }
                    note={
                      currentProject.environments.length
                        ? "Biblioteca com 4.998 aparelhos."
                        : undefined
                    }
                  />
                ) : (
                  <>
                    <div className="tariff-summary">
                      <div>
                        <b>{currentProject.utility || "Minha instalação"}</b>
                        <div>
                          {currentProject.state || "Estado não informado"} · R${" "}
                          {formatNumber(effectiveTariff(currentProject), 4)}/kWh
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        className="link-btn"
                        onClick={() => setModal({ type: "project", existing: currentProject })}
                      >
                        Tarifa
                      </Button>
                    </div>

                    <ConsumptionRing project={currentProject} />

                    <PrimaryButton onClick={() => setModal({ type: "catalog" })}>
                      <Plus size={17} /> Adicionar aparelho
                    </PrimaryButton>

                    <UsageChart project={currentProject} />

                    <div className="tiles">
                      {(
                        [
                          ["bolt", `${formatNumber(totalKwh)} kWh`, "Consumo mensal"],
                          [
                            "trending_up",
                            `${formatNumber(totalKwh / currentProject.days)} kWh`,
                            "Média diária",
                          ],
                          [
                            "electrical_services",
                            currentProject.equipments.length,
                            "Aparelhos",
                          ],
                          ["payments", formatBrl(totalCost / currentProject.days), "Custo diário"],
                        ] as const
                      ).map(([iconName, val, label], idx) => (
                        <div key={label} className="tile">
                          <div className={`icon ${idx === 1 || idx === 2 ? "g" : ""}`}>
                            <AppIcon name={String(iconName)} />
                          </div>
                          <div className="value">{val}</div>
                          <div className="label">{label}</div>
                        </div>
                      ))}
                    </div>

                    <SectionTitle
                      title="Consumo por ambiente"
                      action="Gerenciar ›"
                      onAction={() => navigateTab("environments")}
                    />

                    <div className="environment-breakdown">
                      {currentProject.environments.map((env, idx) => {
                        const envKwh = currentProject.equipments
                          .filter((eq) => eq.envId === env.id)
                          .reduce((acc, eq) => acc + calcKwh(eq), 0);
                        return (
                          <div key={env.id} className="mb-3">
                            <div className="row spread">
                              <span>{env.name}</span>
                              <b>{formatNumber(envKwh)} kWh</b>
                            </div>
                            <div className={`bar ${idx === 0 ? "g" : ""}`}>
                              <i style={{ width: `${Math.max(2, (envKwh / (totalKwh || 1)) * 100)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <SectionTitle
                      title="Maiores consumidores"
                      action="Ver todos ›"
                      onAction={() => navigateTab("equipment")}
                    />

                    <div className="list">
                      {[...currentProject.equipments]
                        .sort((a, b) => calcKwh(b) - calcKwh(a))
                        .slice(0, 5)
                        .map((eq) => (
                          <EquipmentRow
                            key={eq.id}
                            eq={eq}
                            project={currentProject}
                            onClick={() => setModal({ type: "equipment", existing: eq })}
                          />
                        ))}
                    </div>

                    <p className="tiny muted center">
                      Valores estimados; podem diferir da fatura real.
                    </p>
                  </>
                ))
              )}

              {tab === "environments" &&
                (currentProject.environments.length === 0 ? (
                  <EmptyState
                    icon="meeting_room"
                    title="Nenhum ambiente"
                    text="Crie cômodos ou setores para organizar os aparelhos."
                    action="Criar ambiente"
                    onAction={() => setModal({ type: "environment" })}
                  />
                ) : (
                  <>
                    <div className="list">
                      {currentProject.environments.map((env) => {
                        const envItems = currentProject.equipments.filter(
                          (eq) => eq.envId === env.id
                        );
                        const envKwh = envItems.reduce((acc, eq) => acc + calcKwh(eq), 0);
                        return (
                          <div key={env.id}>
                            <div className="item">
                              <div className="avatar">
                                <AppIcon name={env.icon} />
                              </div>
                              <Button
                                variant="ghost"
                                className="grow justify-start p-0 text-left"
                                onClick={() => {
                                  setSelectedEnvFilter(env.id);
                                  navigateTab("equipment");
                                }}
                              >
                                <div>
                                  <div className="item-title">{env.name}</div>
                                  <div className="item-sub">
                                    {envItems.length} aparelhos • {formatNumber(envKwh)} kWh
                                  </div>
                                </div>
                              </Button>
                              <div className="item-end green">
                                {formatBrl(envKwh * effectiveTariff(currentProject))}
                              </div>
                              <Button
                                className="icon-btn"
                                aria-label="Adicionar aparelho"
                                onClick={() => setModal({ type: "catalog", envId: env.id })}
                              >
                                <AppIcon name="add" />
                              </Button>
                              <Button
                                className="icon-btn"
                                aria-label="Editar ambiente"
                                onClick={() => setModal({ type: "environment", existing: env })}
                              >
                                <AppIcon name="edit" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <PrimaryButton onClick={() => setModal({ type: "environment" })}>
                      Novo ambiente
                    </PrimaryButton>
                  </>
                ))}

              {tab === "equipment" && (
                <>
                  <div className="field">
                    <input
                      aria-label="Buscar nos meus aparelhos"
                      placeholder="Buscar nos meus aparelhos"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {currentProject.environments.length > 1 && (
                    <div className="chips">
                      {[{ id: "", name: "Todos" }, ...currentProject.environments].map((env) => (
                        <Button
                          key={env.id}
                          className={`chip ${selectedEnvFilter === env.id ? "active" : ""}`}
                          onClick={() => setSelectedEnvFilter(env.id)}
                        >
                          {env.name}
                        </Button>
                      ))}
                    </div>
                  )}
                  {filteredEquipments.length === 0 ? (
                    <EmptyState
                      icon="electrical_services"
                      title="Nenhum aparelho"
                      text="Adicione aparelhos da biblioteca ou cadastre manualmente."
                      action="Adicionar aparelho"
                      onAction={() => setModal({ type: "catalog", envId: selectedEnvFilter })}
                    />
                  ) : (
                    <>
                      <div className="list">
                        {[...filteredEquipments]
                          .sort((a, b) => calcKwh(b) - calcKwh(a))
                          .map((eq) => (
                            <EquipmentRow
                              key={eq.id}
                              eq={eq}
                              project={currentProject}
                              onClick={() => setModal({ type: "equipment", existing: eq })}
                            />
                          ))}
                      </div>
                      <PrimaryButton
                        onClick={() => setModal({ type: "catalog", envId: selectedEnvFilter })}
                      >
                        Adicionar aparelho
                      </PrimaryButton>
                    </>
                  )}
                </>
              )}

              {tab === "simulate" &&
                (currentProject.equipments.length === 0 ? (
                  <EmptyState
                    icon="trending_up"
                    title="Nada para simular"
                    text="Adicione aparelhos para comparar cenários."
                  />
                ) : (
                  <SimulatorView project={currentProject} sim={sim} setSim={setSim} />
                ))}

              {tab === "settings" && (
                <>
                  <div className="card">
                    <div className="row">
                      <div className="avatar">
                        <AppIcon name="home" />
                      </div>
                      <div className="grow">
                        <div className="item-title">{currentProject.name}</div>
                        <div className="item-sub">{projectTypeLabel(currentProject.type)}</div>
                      </div>
                      <Button
                        className="btn sm ghost"
                        onClick={() => setModal({ type: "project", existing: currentProject })}
                      >
                        Editar
                      </Button>
                    </div>
                    <div className="row spread mt-3">
                      {(
                        [
                          ["Tarifa", `${formatBrl(effectiveTariff(currentProject))}/kWh`],
                          ["Dias/mês", currentProject.days],
                          ["Estado", currentProject.state || "—"],
                        ] as const
                      ).map(([label, val]) => (
                        <div key={label}>
                          <div className="tiny muted">{label}</div>
                          <b>{val}</b>
                        </div>
                      ))}
                    </div>
                    {currentProject.utility && (
                      <p className="tiny muted mt-3">{currentProject.utility}</p>
                    )}
                  </div>

                  <SectionTitle title="Relatório" />
                  <div className="list">
                    <SettingsActionRow
                      icon="content_copy"
                      title="Copiar resumo"
                      text="Texto com emojis para WhatsApp"
                      onClick={handleCopySummary}
                    />
                    <SettingsActionRow
                      icon="picture_as_pdf"
                      title="Salvar em PDF"
                      text="Relatório completo para salvar ou compartilhar"
                      onClick={handleSavePdf}
                    />
                    <SettingsActionRow
                      icon="description"
                      title="Exportar CSV"
                      text="Planilha com todos os aparelhos"
                      onClick={handleExportCsv}
                    />
                  </div>

                  {!isStandalone && (isIos || installPrompt) && (
                    <>
                      <SectionTitle title="Aplicativo" />
                      <SettingsActionRow
                        icon="download"
                        title="Instalar aplicativo"
                        text="Adicionar à tela inicial"
                        onClick={handleInstall}
                      />
                    </>
                  )}

                  <SectionTitle title="Dados" />
                  <div className="list">
                    <SettingsActionRow
                      icon="refresh"
                      title="Trocar de instalação"
                      text={`${store.projects.length} cadastrada(s)`}
                      onClick={() => setModal({ type: "projects" })}
                    />
                    <SettingsActionRow
                      icon="delete"
                      title="Apagar dados"
                      text="Remove instalações deste navegador"
                      onClick={() => {
                        if (confirm("Apagar todas as instalações deste navegador?")) {
                          setStore(emptyStore());
                          setSim({});
                          setSelectedEnvFilter("");
                        }
                      }}
                    />
                  </div>

                  <p className="tiny muted center">Consumo Consciente • versão web</p>
                </>
              )}
            </div>
          ) : (
            <div>
              <EmptyState
                hero
                icon="bolt"
                title="Vamos organizar seu consumo"
                text="Local e energia → ambientes → aparelhos."
                action="Começar"
                onAction={() => setModal({ type: "project" })}
                note="Seus dados ficam neste aparelho e não são enviados."
              />
              <Button
                variant="ghost"
                className="w-full mt-3 gap-2"
                onClick={() => setModal({ type: "example" })}
              >
                <AppIcon name="home" />
                Ver uma casa de exemplo
              </Button>
            </div>
          )}
        </main>

        <nav className="tabbar" aria-label="Navegação principal">
          {TABS.map(([id, label, iconName]) => (
            <Button
              key={id}
              variant="ghost"
              className={`tab ${tab === id ? "active" : ""}`}
              aria-current={tab === id ? "page" : undefined}
              title={label}
              onClick={() => navigateTab(id)}
            >
              <AppIcon name={iconName} />
              <span>{label}</span>
            </Button>
          ))}
        </nav>
      </div>

      {showInstallBanner && !isStandalone && (isIos || installPrompt) && (
        <div className="install-banner">
          <div className="text">
            <b>Instalar aplicativo</b>
            <small>Na tela inicial, mesmo sem internet.</small>
          </div>
          <Button className="btn primary" onClick={handleInstall}>
            Instalar
          </Button>
          <Button
            className="icon-btn"
            aria-label="Fechar convite de instalação"
            onClick={() => setShowInstallBanner(false)}
          >
            <AppIcon name="arrow_back" />
          </Button>
        </div>
      )}

      {modal && (
        <SheetModal
          onClose={closeModal}
          title={
            modal.type === "project"
              ? modal.existing
                ? "Editar instalação"
                : "Nova instalação"
              : modal.type === "environment"
                ? modal.existing
                  ? "Editar ambiente"
                  : "Novo ambiente"
                : modal.type === "equipment"
                  ? modal.existing
                    ? "Editar aparelho"
                    : "Novo aparelho"
                  : modal.type === "catalog"
                    ? "Adicionar aparelho"
                    : modal.type === "projects"
                      ? "Instalações"
                      : modal.type === "summary"
                        ? "Resumo"
                        : modal.type === "example"
                          ? "Uma casa de exemplo"
                          : isIos
                            ? "Instalar no iPhone"
                            : "Instalar aplicativo"
          }
          description={
            modal.type === "project"
              ? "Esses dados são usados em todos os cálculos."
              : modal.type === "environment"
                ? "Cômodo ou setor da instalação."
                : modal.type === "catalog"
                  ? "Escolha o aparelho e depois o modelo."
                  : modal.type === "equipment"
                    ? modal.chosen?.estimated
                      ? "Potência estimada: confirme na etiqueta."
                      : "Informe os dados de uso."
                    : modal.type === "projects"
                      ? "Escolha ou crie uma nova."
                      : modal.type === "install"
                        ? "Adicionar à tela inicial."
                        : "Relatório de consumo."
          }
        >
          {modal.type === "example" && (
            <ExamplePreview onStart={() => setModal({ type: "project" })} />
          )}

          {modal.type === "project" && (
            <ProjectForm
              existing={modal.existing}
              onCancel={closeModal}
              onSave={(draft) => {
                if (modal.existing) {
                  updateProject({ ...modal.existing, ...draft });
                } else {
                  const created = createProject(draft, createId());
                  setStore((prev) => ({
                    projects: [...prev.projects, created],
                    currentId: created.id,
                  }));
                  setSelectedEnvFilter("");
                  setSim({});
                  setTab("home");
                }
                closeModal();
              }}
            />
          )}

          {modal.type === "environment" &&
            currentProject &&
            (modal.existing ? (
              <EnvironmentForm
                existing={modal.existing}
                onSave={(env) => {
                  updateProject({
                    ...currentProject,
                    environments: currentProject.environments.map((item) =>
                      item.id === env.id ? env : item
                    ),
                  });
                  closeModal();
                }}
                onDelete={() => {
                  if (
                    modal.existing &&
                    confirm(`Excluir "${modal.existing.name}" e seus aparelhos?`)
                  ) {
                    updateProject({
                      ...currentProject,
                      environments: currentProject.environments.filter(
                        (item) => item.id !== modal.existing?.id
                      ),
                      equipments: currentProject.equipments.filter(
                        (item) => item.envId !== modal.existing?.id
                      ),
                    });
                    setSelectedEnvFilter("");
                    closeModal();
                  }
                }}
              />
            ) : (
              <RoomPicker
                type={currentProject.type}
                onAdd={(template, count) => {
                  updateProject({
                    ...currentProject,
                    environments: [
                      ...currentProject.environments,
                      ...expandRooms(currentProject.environments, template, count, createId),
                    ],
                  });
                  closeModal();
                }}
              />
            ))}

          {modal.type === "catalog" && (
            <CatalogPicker
              onChoose={(item) =>
                setModal({ type: "equipment", chosen: item, envId: modal.envId })
              }
              onManual={() => setModal({ type: "equipment", envId: modal.envId })}
              onCancel={closeModal}
            />
          )}

          {modal.type === "equipment" && currentProject && (
            <EquipmentForm
              project={currentProject}
              existing={modal.existing}
              chosen={modal.chosen}
              envId={modal.envId}
              onSave={(eq) => {
                if (!hasValidEnv(currentProject, eq)) {
                  setToast("Crie um ambiente primeiro.");
                  return;
                }
                updateProject({
                  ...currentProject,
                  equipments: modal.existing
                    ? currentProject.equipments.map((item) =>
                        item.id === eq.id ? eq : item
                      )
                    : [...currentProject.equipments, eq],
                });
                setSim({});
                closeModal();
              }}
              onDelete={() => {
                if (modal.existing && confirm(`Excluir "${modal.existing.name}"?`)) {
                  updateProject({
                    ...currentProject,
                    equipments: currentProject.equipments.filter(
                      (item) => item.id !== modal.existing?.id
                    ),
                  });
                  setSim({});
                  closeModal();
                }
              }}
            />
          )}

          {modal.type === "projects" && (
            <>
              <div className="list">
                {store.projects.map((proj) => (
                  <SettingsActionRow
                    key={proj.id}
                    icon="home"
                    title={proj.name}
                    text={`${projectTypeLabel(proj.type)} • ${proj.equipments.length} aparelhos${
                      proj.id === store.currentId ? " • Atual" : ""
                    }`}
                    onClick={() => {
                      setStore((prev) => ({ ...prev, currentId: proj.id }));
                      setSelectedEnvFilter("");
                      setSim({});
                      closeModal();
                    }}
                  />
                ))}
              </div>
              <div className="sheet-actions">
                <PrimaryButton ghost onClick={closeModal}>
                  Fechar
                </PrimaryButton>
                <PrimaryButton onClick={() => setModal({ type: "project" })}>
                  Nova instalação
                </PrimaryButton>
              </div>
            </>
          )}

          {modal.type === "install" && isIos && (
            <>
              <ol className="ios-steps">
                <li>
                  <span>1</span>
                  <p>
                    Abra no <b>Safari</b>.
                  </p>
                </li>
                <li>
                  <span>2</span>
                  <p>
                    Toque em <b>Compartilhar</b>.
                  </p>
                </li>
                <li>
                  <span>3</span>
                  <p>
                    Escolha <b>Adicionar à Tela de Início</b>.
                  </p>
                </li>
                <li>
                  <span>4</span>
                  <p>
                    Toque em <b>Adicionar</b>.
                  </p>
                </li>
              </ol>
              <div className="sheet-actions">
                <PrimaryButton onClick={closeModal}>Entendi</PrimaryButton>
              </div>
            </>
          )}

          {modal.type === "summary" && (
            <>
              <textarea className="w-full bg-background p-3" rows={12} readOnly value={summaryText} />
              <div className="sheet-actions">
                <PrimaryButton onClick={closeModal}>Fechar</PrimaryButton>
              </div>
            </>
          )}
        </SheetModal>
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}

      {currentProject && (
        <section className="print-only">
          <h1>Consumo Consciente</h1>
          <h2>{currentProject.name}</h2>
          <p>
            {formatNumber(totalKwh)} kWh • Custo mensal: {formatBrl(totalCost)} • Tarifa:{" "}
            {formatBrl(effectiveTariff(currentProject))}/kWh
          </p>
          <table>
            <thead>
              <tr>
                <th>Aparelho</th>
                <th>Ambiente</th>
                <th>kWh</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {currentProject.equipments.map((eq) => (
                <tr key={eq.id}>
                  <td>{eq.name}</td>
                  <td>
                    {currentProject.environments.find((env) => env.id === eq.envId)?.name}
                  </td>
                  <td>{formatNumber(calcKwh(eq))}</td>
                  <td>{formatBrl(calcKwh(eq) * effectiveTariff(currentProject))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>Valores estimados; podem diferir da fatura real.</p>
        </section>
      )}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConsumoApp />
    </QueryClientProvider>
  );
}
