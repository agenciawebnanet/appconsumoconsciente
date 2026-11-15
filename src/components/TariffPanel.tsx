import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/src/components/ui/button";
import { formatNumber, STATES, UTILITIES_BY_STATE } from "@/src/lib/energy";
import type { EnergyApiResponse, Project } from "@/src/types/energy";

export type ProjectDraft = Pick<
  Project,
  | "name"
  | "type"
  | "tariff"
  | "days"
  | "state"
  | "utility"
  | "tariffSource"
  | "tariffDate"
  | "includeFlag"
  | "flagRate"
  | "flagName"
  | "flagMonth"
>;

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split("-");
  return `${month}/${year}`;
};

export function TariffPanel({
  value,
  onChange,
}: {
  value: ProjectDraft;
  onChange: (next: ProjectDraft) => void;
}) {
  const [customUtility, setCustomUtility] = useState(false);

  const query = useQuery<EnergyApiResponse>({
    queryKey: ["official-energy", value.state],
    enabled: !!value.state,
    staleTime: 3600000,
    retry: false,
    queryFn: async () => {
      const res = await fetch(`/api/public/energy?state=${encodeURIComponent(value.state)}`);
      if (!res.ok) throw new Error("Fonte oficial indisponível");
      return res.json() as Promise<EnergyApiResponse>;
    },
  });

  const tariffs = query.data?.tariffs ?? [];
  const utilities = [
    ...new Set([
      ...tariffs.map((t) => t.utility),
      ...(UTILITIES_BY_STATE[value.state] ?? []),
      ...(value.utility ? [value.utility] : []),
    ]),
  ];

  const matchedTariff = tariffs.find((t) => t.utility === value.utility);
  const flag = query.data?.flag ?? null;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const isCurrentMonthFlag = flag?.month === currentMonth;

  return (
    <div className="tariff-panel">
      <label className="field">
        <span className="small muted">Estado</span>
        <select
          value={value.state}
          onChange={(e) =>
            onChange({
              ...value,
              state: e.target.value,
              utility: "",
              tariffSource: undefined,
              tariffDate: undefined,
              includeFlag: false,
              flagRate: undefined,
              flagName: undefined,
              flagMonth: undefined,
            })
          }
        >
          <option value="">Selecione seu estado</option>
          {Object.entries(STATES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="small muted">Concessionária</span>
        {customUtility ? (
          <input
            placeholder="Nome na sua conta de energia"
            value={value.utility}
            onChange={(e) =>
              onChange({
                ...value,
                utility: e.target.value,
                tariffSource: undefined,
              })
            }
          />
        ) : (
          <select
            value={value.utility}
            disabled={!value.state}
            onChange={(e) =>
              onChange({
                ...value,
                utility: e.target.value,
                tariffSource: undefined,
                includeFlag: false,
              })
            }
          >
            <option value="">Selecione sua concessionária</option>
            {utilities.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        )}
      </label>

      <Button
        variant="ghost"
        className="link-btn justify-start p-0"
        onClick={() => setCustomUtility(!customUtility)}
      >
        {customUtility ? "Voltar à lista" : "Não encontrei minha concessionária"}
      </Button>

      {query.isFetching && (
        <p className="tiny muted" role="status">
          Consultando ANEEL…
        </p>
      )}

      {(query.isError || query.data?.error) && (
        <p className="tiny muted" role="status">
          {query.data?.error ?? "Não foi possível consultar a ANEEL. Informe a tarifa da sua conta."}
        </p>
      )}

      {matchedTariff && (
        <div className="tariff-reference">
          Tarifa residencial de referência
          <b>R$ {formatNumber(matchedTariff.tariff, 4)} / kWh</b>
          <small>
            ANEEL · vigência {matchedTariff.validFrom} a {matchedTariff.validTo}
          </small>
          <small>TE + TUSD · sem impostos, bandeira e iluminação pública.</small>
          <Button
            className="btn ghost"
            onClick={() =>
              onChange({
                ...value,
                tariff: matchedTariff.tariff,
                tariffSource: matchedTariff.source,
                tariffDate: matchedTariff.validFrom,
                flagName: flag?.name,
                flagMonth: flag?.month,
                flagRate: isCurrentMonthFlag ? flag?.rate : 0,
                includeFlag: false,
              })
            }
          >
            Usar tarifa de referência
          </Button>
        </div>
      )}

      {value.state &&
        (flag ? (
          <div className="flag-row">
            <i
              className={`flag-dot ${
                flag.name.toLowerCase().includes("vermelha")
                  ? "flag-red"
                  : flag.name.toLowerCase().includes("amarela")
                    ? "flag-yellow"
                    : ""
              }`}
            />
            <div>
              <b>Bandeira {flag.name}</b>
              <small>
                {isCurrentMonthFlag ? "Mês atual" : "Última publicação disponível"} ·{" "}
                {formatMonth(flag.month)}
              </small>
              <small>Sistema Interligado Nacional, não uma bandeira por estado.</small>
              {!isCurrentMonthFlag && (
                <small>Não aplicada automaticamente: aguarde publicação do mês atual.</small>
              )}
            </div>
            <span>R$ {formatNumber(flag.rate, 5)}/kWh</span>
          </div>
        ) : (
          !query.isFetching && (
            <p className="tiny muted">Bandeira atual não confirmada na fonte oficial.</p>
          )
        ))}

      <label className="field">
        <span className="small muted">Tarifa usada no cálculo (R$/kWh)</span>
        <input
          type="number"
          min="0"
          step="0.0001"
          value={value.tariff}
          onChange={(e) =>
            onChange({
              ...value,
              tariff: Math.max(0, Number(e.target.value)),
              tariffSource: undefined,
              includeFlag: false,
            })
          }
        />
      </label>

      <p className="tiny muted">
        Para maior precisão, use o valor do kWh da sua conta. Se já inclui a bandeira, não some
        novamente.
      </p>

      {flag && isCurrentMonthFlag && (
        <label className="flag-option">
          <input
            type="checkbox"
            checked={value.includeFlag ?? false}
            onChange={(e) =>
              onChange({
                ...value,
                includeFlag: e.target.checked,
                flagRate: flag.rate,
                flagName: flag.name,
                flagMonth: flag.month,
              })
            }
          />
          Somar bandeira separadamente
        </label>
      )}

      {value.tariffSource && (
        <a className="tiny yellow" href={value.tariffSource} target="_blank" rel="noreferrer">
          Ver fonte ANEEL
        </a>
      )}
    </div>
  );
}
