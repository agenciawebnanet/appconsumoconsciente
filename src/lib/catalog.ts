import rawCatalog from "@/src/data/catalog.json";
import { normalizeText } from "@/src/lib/energy";
import type { CatalogAppliance, CatalogGroup } from "@/src/types/energy";

interface RawCatalog {
  v: number;
  categorias: [string, string][];
  itens: [
    number,
    string,
    string,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
  ][];
}

const catalogData = rawCatalog as RawCatalog;

const CURATED_APPLIANCES: CatalogAppliance[] = [
  ...[32, 43, 50, 55, 65, 75].map((size, idx) => ({
    type: "Smart TV",
    variant: `${size} polegadas`,
    powerW: [40, 70, 100, 120, 180, 250][idx] ?? 100,
    category: "Entretenimento",
    hours: 4.5,
    days: 30,
    factor: 1,
  })),
  ...[9000, 12000, 18000, 24000, 30000].flatMap((btus, idx) => [
    {
      type: "Ar-condicionado split inverter",
      variant: `${btus.toLocaleString("pt-BR")} BTUs`,
      powerW: [700, 1000, 1500, 2000, 2500][idx] ?? 1000,
      category: "Climatização",
      hours: 8,
      days: 30,
      factor: 0.7,
    },
    {
      type: "Ar-condicionado split convencional",
      variant: `${btus.toLocaleString("pt-BR")} BTUs`,
      powerW: [900, 1200, 1800, 2400, 3000][idx] ?? 1200,
      category: "Climatização",
      hours: 8,
      days: 30,
      factor: 0.7,
    },
  ]),
  {
    type: "Carregador de telefone",
    variant: "Comum",
    powerW: 10,
    category: "Eletrônicos",
    hours: 3,
    days: 30,
    factor: 1,
  },
  {
    type: "Carregador de telefone",
    variant: "Carga rápida",
    powerW: 25,
    category: "Eletrônicos",
    hours: 2,
    days: 30,
    factor: 1,
  },
].map((item) => ({
  ...item,
  name: `${item.type} — ${item.variant}`,
  estimated: true,
}));

const CATALOG_ITEMS: CatalogAppliance[] = catalogData.itens.map((item) => ({
  name: item[2] ? `${item[1]} — ${item[2]}` : String(item[1]),
  type: String(item[1]),
  variant: String(item[2] || ""),
  category: String(catalogData.categorias[Number(item[0])]?.[0] ?? "Outros"),
  powerW: Number(item[3]) || 0,
  hours: Number(item[6]) || 1,
  days: Number(item[7]) || 30,
  factor: Number(item[8] ?? 1),
  estimated: item[11] === 1,
}));

const EXCLUDED_TYPES = [
  "Smart TV 4K",
  "Smart TV 8K",
  "Ar-condicionado split inverter",
  "Ar-condicionado split convencional",
  "Carregador USB de celular",
  "Carregador rápido USB-C",
];

export const ALL_APPLIANCES: CatalogAppliance[] = [
  ...CURATED_APPLIANCES,
  ...CATALOG_ITEMS.filter((item) => !EXCLUDED_TYPES.includes(item.type)),
];

const SYNONYMS: Record<string, string> = {
  televisao: "tv",
  televisor: "tv",
  refrigerador: "geladeira",
  lampadas: "lampada",
  luz: "lampada",
  airfryer: "air fryer",
  lavadora: "maquina de lavar",
  arcondicionado: "ar condicionado",
};

export function searchAppliances(query: string): CatalogAppliance[] {
  let normalized = normalizeText(query);
  normalized = (SYNONYMS[normalized] ?? normalized)
    .replace(/\b(televisao|televisor)\b/g, "tv")
    .replace(/\b(celular|smartphone)\b/g, "telefone")
    .replace(/\b(polegada|pol)\b/g, "polegadas")
    .replace(/\bbtu\b/g, "btus")
    .replace(/\b(\d+)\s+(\d{3})\b/g, "$1$2");

  if (!normalized) return ALL_APPLIANCES;

  const tokens = normalized.split(" ");
  return ALL_APPLIANCES.map((item, index) => {
    const normalizedType = normalizeText(item.type);
    const normalizedFull = normalizeText(`${item.type} ${item.variant}`).replace(
      /\b(\d+)\s+(\d{3})\b/g,
      "$1$2"
    );
    const typeMatches = tokens.every((t) => normalizedType.includes(t));
    const allMatch = tokens.every((t) => normalizedFull.includes(t));
    const score = allMatch
      ? normalizedType === normalized
        ? 100
        : normalizedType.startsWith(normalized)
          ? 90
          : typeMatches
            ? 80
            : 40
      : 0;
    return { item, index, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

export function groupedSearch(query: string): CatalogGroup[] {
  const groups = new Map<string, CatalogGroup>();
  for (const item of searchAppliances(query)) {
    const key = normalizeText(item.type);
    const group = groups.get(key) ?? { name: item.type, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].slice(0, 60);
}
