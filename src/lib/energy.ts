import type { Environment, Equipment, Project, ProjectType, StoreState, TabId } from "@/src/types/energy";

export const ROOM_ICONS = [
  "meeting_room",
  "bed",
  "weekend",
  "kitchen",
  "bathtub",
  "local_laundry_service",
  "directions_car",
  "factory",
  "storefront",
  "agriculture",
  "construction",
  "business_center",
] as const;

export const ROOM_ICON_LABELS = [
  "Cômodo",
  "Quarto",
  "Sala",
  "Cozinha",
  "Banheiro",
  "Lavanderia",
  "Garagem",
  "Fábrica",
  "Loja",
  "Rural",
  "Construção",
  "Escritório",
] as const;

export const TABS: ReadonlyArray<[TabId, string, string]> = [
  ["home", "Início", "home"],
  ["environments", "Ambientes", "meeting_room"],
  ["equipment", "Aparelhos", "electrical_services"],
  ["simulate", "Simular", "trending_up"],
  ["settings", "Ajustes", "settings"],
];

export const PROJECT_TYPES: ReadonlyArray<[ProjectType, string]> = [
  ["RESIDENTIAL", "Residência"],
  ["COMMERCIAL", "Comércio"],
  ["INDUSTRIAL", "Indústria"],
  ["RURAL", "Rural"],
  ["CONSTRUCTION", "Construção"],
];

export const STATES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

export const UTILITIES_BY_STATE: Record<string, string[]> = {
  AC: ["Energisa Acre"],
  AL: ["Equatorial Alagoas"],
  AP: ["Equatorial Amapá"],
  AM: ["Amazonas Energia"],
  BA: ["Neoenergia Coelba"],
  CE: ["Enel Ceará"],
  DF: ["Neoenergia Brasília"],
  ES: ["EDP Espírito Santo"],
  GO: ["Equatorial Goiás"],
  MA: ["Equatorial Maranhão"],
  MT: ["Energisa Mato Grosso"],
  MS: ["Energisa Mato Grosso do Sul"],
  MG: ["CEMIG Distribuição"],
  PA: ["Equatorial Pará"],
  PB: ["Energisa Paraíba"],
  PR: ["COPEL Distribuição"],
  PE: ["Neoenergia Pernambuco"],
  PI: ["Equatorial Piauí"],
  RJ: ["Enel Rio", "Light"],
  RN: ["Neoenergia Cosern"],
  RS: ["CEEE Equatorial", "RGE"],
  RO: ["Energisa Rondônia"],
  RR: ["Energisa Roraima"],
  SC: ["Celesc Distribuição"],
  SP: ["Enel São Paulo", "CPFL Paulista", "CPFL Piratininga", "EDP São Paulo", "Elektro"],
  SE: ["Energisa Sergipe"],
  TO: ["Energisa Tocantins"],
};

export const EXAMPLE_ROOMS = [
  { name: "Quarto", icon: "bed", appliances: ["Ar-condicionado", "Carregador de telefone"] },
  { name: "Cozinha", icon: "kitchen", appliances: ["Micro-ondas", "Geladeira"] },
  { name: "Sala", icon: "weekend", appliances: ["TV", "Lâmpada"] },
];

export const roomPresets = (type: ProjectType) =>
  type === "RESIDENTIAL"
    ? [
        { name: "Quarto", icon: "bed" },
        { name: "Sala", icon: "weekend" },
        { name: "Cozinha", icon: "kitchen" },
        { name: "Banheiro", icon: "bathtub" },
        { name: "Lavanderia", icon: "local_laundry_service" },
        { name: "Garagem", icon: "directions_car" },
      ]
    : [
        { name: "Galpão", icon: "factory" },
        { name: "Produção", icon: "engineering" },
        { name: "Escritório", icon: "business_center" },
        { name: "Estoque", icon: "storefront" },
        { name: "Copa", icon: "coffee" },
        { name: "Área externa", icon: "agriculture" },
      ];

export const createId = () => crypto.randomUUID();

export const emptyStore = (): StoreState => ({ projects: [], currentId: null });

export const projectTypeLabel = (type: string) =>
  PROJECT_TYPES.find(([code]) => code === type)?.[1] ?? type;

export const effectiveTariff = (p: Project) =>
  p.tariff + (p.includeFlag ? p.flagRate ?? 0 : 0);

export const calcKwh = (eq: Equipment) => {
  if (eq.monthlyKwh != null) return eq.monthlyKwh * eq.qty;
  if (eq.weeklyMinutes?.length === 7) {
    const totalMinutes = eq.weeklyMinutes.reduce((acc, m) => acc + m, 0);
    return (eq.powerW / 1000) * (totalMinutes / 60) * (eq.days / 7) * eq.qty;
  }
  return (eq.powerW / 1000) * eq.qty * eq.hours * eq.days * eq.factor;
};

export const avgDailyMinutes = (eq: Equipment) =>
  eq.weeklyMinutes?.length === 7
    ? eq.weeklyMinutes.reduce((acc, m) => acc + m, 0) / 7
    : eq.hours * 60;

export const simulateKwh = (eq: Equipment, minutesPerDay: number) =>
  (eq.powerW / 1000) * eq.qty * (minutesPerDay / 60) * eq.days * (eq.weeklyMinutes ? 1 : eq.factor);

export const formatBrl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatNumber = (value: number, decimals = 2) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export const formatDuration = (minutes: number) =>
  minutes < 60
    ? `${formatNumber(minutes, 1)} min`
    : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${formatNumber(minutes % 60, 1)} min` : ""}`;

export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function inferIconName(name: string): string {
  const normalized = normalizeText(name);
  const matched = [
    ["ar condicionado|split|climatiz", "ac_unit"],
    ["ventilador|exaustor", "air"],
    ["geladeira|freezer|frigobar", "kitchen"],
    ["micro|forno|fogao|air fryer", "local_fire_department"],
    ["lampada|ilumin|refletor", "lightbulb"],
    ["tv|televisor|monitor", "tv"],
    ["maquina de lavar|lava|secadora", "local_laundry_service"],
    ["chuveiro|torneira", "bathtub"],
    ["computador|notebook", "computer"],
    ["motor|bomba|compressor", "engineering"],
    ["cafeteira|chaleira", "coffee"],
    ["liquidificador|batedeira|panela", "restaurant"],
    ["roteador", "router"],
    ["impressora", "print"],
    ["videogame", "sports_esports"],
  ].find(([pattern]) => new RegExp(pattern ?? "a^").test(normalized));
  return matched?.[1] ?? "bolt";
}

export const displayTitle = (name: string) => name.split(/\s+[—–]\s+/)[0] ?? name;

export const modelDetail = (name: string) =>
  name.split(/\s+[—–]\s+/).slice(1).join(" — ");

export function expandRooms(
  existing: Environment[],
  template: { name: string; icon: string },
  count: number,
  makeId: () => string
): Environment[] {
  const safeCount = Math.max(1, Math.floor(count));
  const used = new Set(existing.map((e) => e.name));
  if (safeCount === 1 && !used.has(template.name)) {
    return [{ ...template, id: makeId() }];
  }
  let index = 1;
  return Array.from({ length: safeCount }, () => {
    while (used.has(`${template.name} ${index}`)) index++;
    const name = `${template.name} ${index++}`;
    used.add(name);
    return { ...template, name, id: makeId() };
  });
}

export function createProject(
  data: Omit<Project, "id" | "environments" | "equipments" | "setupStage">,
  id: string
): Project {
  return {
    ...data,
    id,
    environments: [],
    equipments: [],
    setupStage: "rooms",
  };
}

export function hasValidEnv(project: Project, eq: Equipment): boolean {
  return project.environments.some((env) => env.id === eq.envId);
}
