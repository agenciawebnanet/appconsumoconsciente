import { useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Lightbulb,
  Refrigerator,
  Search,
  ShowerHead,
  Tv,
  WashingMachine,
  Wind,
  X,
} from "lucide-react";
import { AppIcon } from "@/src/components/AppIcon";
import { Button } from "@/src/components/ui/button";
import { groupedSearch } from "@/src/lib/catalog";
import { inferIconName } from "@/src/lib/energy";
import type { CatalogAppliance, CatalogGroup } from "@/src/types/energy";

const POPULAR_APPLIANCES = [
  ["Geladeira", Refrigerator],
  ["Ar-condicionado", Wind],
  ["Chuveiro", ShowerHead],
  ["TV", Tv],
  ["Lâmpada", Lightbulb],
  ["Máquina de lavar", WashingMachine],
] as const;

export function CatalogPicker({
  onChoose,
  onManual,
  onCancel,
}: {
  onChoose: (item: CatalogAppliance) => void;
  onManual: () => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<CatalogGroup | null>(null);
  const groups = groupedSearch(query);

  return (
    <>
      <div className="appliance-search">
        <Search size={19} />
        <input
          aria-label="Buscar aparelho pelo nome"
          autoFocus
          placeholder="TV 50 polegadas, ar 12000 BTUs…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedGroup(null);
          }}
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Limpar busca"
            onClick={() => {
              setQuery("");
              setSelectedGroup(null);
            }}
          >
            <X />
          </Button>
        )}
      </div>

      {!query && !selectedGroup && (
        <div className="popular-appliances">
          {POPULAR_APPLIANCES.map(([label, Icon]) => (
            <Button key={label} variant="ghost" onClick={() => setQuery(label)}>
              <Icon />
              <span>{label}</span>
            </Button>
          ))}
        </div>
      )}

      {selectedGroup ? (
        <>
          <Button
            variant="ghost"
            className="back-results"
            onClick={() => setSelectedGroup(null)}
          >
            <ArrowLeft /> {selectedGroup.name}
          </Button>
          <div className="results appliance-results">
            {selectedGroup.items.map((item, idx) => (
              <Button
                key={idx}
                variant="ghost"
                className="result"
                onClick={() => onChoose(item)}
              >
                <div className="grow">
                  <b>{item.variant || item.type}</b>
                  <small>
                    {item.estimated
                      ? "Consumo estimado · ajustável"
                      : "Dados de referência · ajustáveis"}
                  </small>
                </div>
                <ChevronRight size={16} />
              </Button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="tiny muted my-3">
            {query ? `${groups.length} tipos encontrados` : "Aparelhos por nome"}
          </p>
          <div className="results appliance-results">
            {groups.map((group) => (
              <Button
                key={group.name}
                variant="ghost"
                className="result"
                onClick={() =>
                  group.items.length === 1 && group.items[0]
                    ? onChoose(group.items[0])
                    : setSelectedGroup(group)
                }
              >
                <div className="avatar">
                  <AppIcon name={inferIconName(group.name)} />
                </div>
                <div className="grow">
                  <b>{group.name}</b>
                  <small>
                    {group.items.length} {group.items.length === 1 ? "opção" : "opções"} ·{" "}
                    {group.items
                      .slice(0, 3)
                      .map((item) => item.variant.replace(/^Faixa /, ""))
                      .join(" · ")}
                  </small>
                </div>
                <ChevronRight size={16} />
              </Button>
            ))}

            {!groups.length && (
              <div className="no-results">
                <Search />
                <b>Nenhum aparelho encontrado</b>
                <p>Não encontrou o seu? Cadastre pelo nome e potência.</p>
                <Button className="btn primary" onClick={onManual}>
                  Cadastrar meu aparelho
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <div className="sheet-actions">
        <Button className="btn ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button className="btn" onClick={onManual}>
          Cadastrar manualmente
        </Button>
      </div>
    </>
  );
}
