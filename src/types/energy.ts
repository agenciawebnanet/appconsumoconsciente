export type ProjectType =
  | "RESIDENTIAL"
  | "COMMERCIAL"
  | "INDUSTRIAL"
  | "RURAL"
  | "CONSTRUCTION";

export type SetupStage = "rooms" | "equipment" | "done";

export type TabId = "home" | "environments" | "equipment" | "simulate" | "settings";

export interface Environment {
  id: string;
  name: string;
  icon: string;
}

export interface Equipment {
  id: string;
  name: string;
  category: string;
  powerW: number;
  qty: number;
  hours: number;
  days: number;
  factor: number;
  envId: string;
  monthlyKwh?: number | null;
  weeklyMinutes?: number[] | null;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  tariff: number;
  days: number;
  state: string;
  utility: string;
  tariffSource?: string;
  tariffDate?: string;
  includeFlag?: boolean;
  flagRate?: number;
  flagName?: string;
  flagMonth?: string;
  environments: Environment[];
  equipments: Equipment[];
  setupStage?: SetupStage;
}

export interface StoreState {
  projects: Project[];
  currentId: string | null;
}

export interface CatalogAppliance {
  name: string;
  type: string;
  variant: string;
  category: string;
  powerW: number;
  hours: number;
  days: number;
  factor: number;
  estimated?: boolean;
}

export interface CatalogGroup {
  name: string;
  items: CatalogAppliance[];
}

export interface TariffInfo {
  utility: string;
  tariff: number;
  validFrom: string;
  validTo: string;
  source: string;
}

export interface FlagInfo {
  name: string;
  month: string;
  rate: number;
}

export interface EnergyApiResponse {
  tariffs: TariffInfo[];
  flag: FlagInfo | null;
  checkedAt: string;
  error?: string;
}

export type ModalState =
  | { type: "project"; existing?: Project }
  | { type: "environment"; existing?: Environment }
  | { type: "catalog"; envId?: string }
  | { type: "equipment"; existing?: Equipment; chosen?: CatalogAppliance; envId?: string }
  | { type: "projects" }
  | { type: "summary" }
  | { type: "example" }
  | { type: "install" }
  | { type: "tutorial" }
  | null;
