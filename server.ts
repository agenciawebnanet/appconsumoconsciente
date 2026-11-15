import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const STATE_UTILITY_KEYWORDS: Record<string, string[]> = {
  AC: ["ENERGISA ACRE", "ELETROACRE"],
  AL: ["EQUATORIAL ALAGOAS", "CEAL"],
  AP: ["EQUATORIAL AMAPA", "CEA"],
  AM: ["AMAZONAS ENERGIA"],
  BA: ["COELBA", "NEOENERGIA COELBA"],
  CE: ["ENEL CEARA", "COELCE"],
  DF: ["NEOENERGIA BRASILIA", "CEB"],
  ES: ["EDP ESPIRITO SANTO", "ESCELSA"],
  GO: ["EQUATORIAL GOIAS", "CELG"],
  MA: ["EQUATORIAL MARANHAO", "CEMAR"],
  MT: ["ENERGISA MATO GROSSO", "CEMAT"],
  MS: ["ENERGISA MATO GROSSO DO SUL", "ENERSUL"],
  MG: ["CEMIG"],
  PA: ["EQUATORIAL PARA", "CELPA"],
  PB: ["ENERGISA PARAIBA", "SAELPA"],
  PR: ["COPEL"],
  PE: ["NEOENERGIA PERNAMBUCO", "CELPE"],
  PI: ["EQUATORIAL PIAUI", "CEPISA"],
  RJ: ["ENEL RIO", "AMPLA", "LIGHT"],
  RN: ["COSERN", "NEOENERGIA COSERN"],
  RS: ["CEEE", "RGE"],
  RO: ["ENERGISA RONDONIA", "CERON"],
  RR: ["RORAIMA ENERGIA", "BOA VISTA"],
  SC: ["CELESC"],
  SP: ["ENEL SAO PAULO", "ELETROPAULO", "CPFL PAULISTA", "CPFL PIRATININGA", "EDP SAO PAULO", "ELEKTRO"],
  SE: ["ENERGISA SERGIPE", "SULGIPE"],
  TO: ["ENERGISA TOCANTINS", "CELTINS"],
};

interface AneelTariffRecord {
  SigNomeAgente?: string;
  NomSubGrupo?: string;
  DscModalidadeTarifaria?: string;
  DscClasse?: string;
  DscSubClasse?: string;
  DscBaseTarifaria?: string;
  DatInicioVigencia?: string;
  DatFimVigencia?: string;
  VlrTUSD?: string;
  VlrTE?: string;
}

interface AneelFlagRecord {
  DatCompetencia?: string;
  NomBandeiraAcionada?: string;
  VlrAdicionalBandeira?: string;
}

const parseBrNum = (val?: string) => {
  if (!val) return 0;
  const num = Number(String(val).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(num) ? num : 0;
};

async function fetchAneelEnergy(state: string) {
  const checkedAt = new Date().toISOString();
  const upperState = state.trim().toUpperCase();
  const keywords = STATE_UTILITY_KEYWORDS[upperState] ?? [];

  try {
    const tariffUrl =
      "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=fcf2906c-7c32-4b9b-a637-054e7a5234f4&limit=500&q=" +
      encodeURIComponent(keywords[0]?.split(" ")[0] ?? upperState);
    const flagUrl =
      "https://dadosabertos.aneel.gov.br/api/3/action/datastore_search?resource_id=0591b8f6-fe54-437b-b72b-1aa2efd46e42&limit=5&sort=DatCompetencia%20desc";

    const [tariffRes, flagRes] = await Promise.all([
      fetch(tariffUrl, { signal: AbortSignal.timeout(4500) }),
      fetch(flagUrl, { signal: AbortSignal.timeout(4500) }),
    ]);

    if (!tariffRes.ok) {
      throw new Error(`ANEEL status ${tariffRes.status}`);
    }

    const tariffJson = (await tariffRes.json()) as {
      result?: { records?: AneelTariffRecord[] };
    };
    const records = tariffJson.result?.records ?? [];

    const today = new Date().toISOString().slice(0, 10);
    const matched = records
      .filter(
        (r) =>
          r.NomSubGrupo === "B1" &&
          r.DscClasse === "Residencial" &&
          r.DscSubClasse === "Residencial" &&
          r.DscModalidadeTarifaria === "Convencional" &&
          r.DscBaseTarifaria === "Tarifa de Aplicação" &&
          (!r.DatFimVigencia || r.DatFimVigencia >= today) &&
          (keywords.length === 0 ||
            keywords.some((kw) =>
              (r.SigNomeAgente ?? "").toUpperCase().includes(kw.split(" ")[0] ?? "")
            ))
      )
      .map((r) => {
        const te = parseBrNum(r.VlrTE);
        const tusd = parseBrNum(r.VlrTUSD);
        return {
          utility: r.SigNomeAgente ?? "Concessionária",
          tariff: Number(((te + tusd) / 1000).toFixed(5)),
          validFrom: r.DatInicioVigencia ?? "",
          validTo: r.DatFimVigencia ?? "",
          source: "https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica",
        };
      })
      .filter((t) => t.tariff > 0);

    let flag: { name: string; month: string; rate: number } | null = null;
    if (flagRes.ok) {
      const flagJson = (await flagRes.json()) as {
        result?: { records?: AneelFlagRecord[] };
      };
      const latest = flagJson.result?.records?.[0];
      if (latest?.NomBandeiraAcionada && latest?.DatCompetencia) {
        flag = {
          name: latest.NomBandeiraAcionada,
          month: latest.DatCompetencia.slice(0, 7),
          rate: parseBrNum(latest.VlrAdicionalBandeira) / 1000,
        };
      }
    }

    return {
      tariffs: matched,
      flag,
      checkedAt,
    };
  } catch {
    return {
      tariffs: [],
      flag: null,
      checkedAt,
      error: "ANEEL indisponível agora. Use a tarifa da sua conta.",
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get("/api/public/energy", async (req, res) => {
    const state = String(req.query.state ?? "");
    const payload = await fetchAneelEnergy(state);
    res.json(payload);
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
