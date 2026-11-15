import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  calcKwh,
  effectiveTariff,
  formatBrl,
  formatDuration,
  formatNumber,
  PROJECT_TYPES,
} from "@/src/lib/energy";
import type { Project } from "@/src/types/energy";

const PDF_COLORS = {
  ink: [20, 24, 28] as [number, number, number],
  accent: [255, 214, 10] as [number, number, number],
  green: [30, 132, 91] as [number, number, number],
  muted: [98, 108, 116] as [number, number, number],
  paper: [255, 255, 255] as [number, number, number],
  line: [233, 236, 239] as [number, number, number],
};

export function generatePdfReport(project: Project): Blob {
  const doc = new jsPDF();
  const totalKwh = project.equipments.reduce((acc, eq) => acc + calcKwh(eq), 0);
  const totalCost = totalKwh * effectiveTariff(project);

  const drawHeader = () => {
    doc.setFillColor(...PDF_COLORS.ink);
    doc.rect(0, 0, 210, 34, "F");
    doc.setTextColor(...PDF_COLORS.accent);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Consumo Consciente", 14, 15);
    doc.setTextColor(...PDF_COLORS.paper);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Relatório de consumo e gastos de energia", 14, 24);
  };

  drawHeader();
  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(project.name, 182);
  doc.text(nameLines, 14, 46);

  let y = 48 + nameLines.length * 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.muted);
  const typeLabel = PROJECT_TYPES.find(([code]) => code === project.type)?.[1] ?? project.type;
  const subtitle = doc.splitTextToSize(
    `${typeLabel} • ${project.days} dias/mês • Tarifa ${formatBrl(effectiveTariff(project))}/kWh${
      project.state ? ` • ${project.state}` : ""
    }${project.utility ? ` • ${project.utility}` : ""}`,
    182
  );
  doc.text(subtitle, 14, y);
  y += subtitle.length * 5 + 8;

  const kpis: [string, string][] = [
    ["CUSTO MENSAL", formatBrl(totalCost)],
    ["CONSUMO MENSAL", `${formatNumber(totalKwh)} kWh`],
    ["CUSTO DIÁRIO", formatBrl(totalCost / project.days)],
  ];

  kpis.forEach(([label, val], idx) => {
    const x = 14 + idx * 62;
    doc.setFillColor(...PDF_COLORS.line);
    doc.roundedRect(x, y, 58, 25, 2, 2, "F");
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFontSize(8);
    doc.text(label ?? "", x + 4, y + 7);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(val ?? "", x + 4, y + 18);
    doc.setFont("helvetica", "normal");
  });

  y += 36;
  const drawSectionTitle = (title: string) => {
    doc.setTextColor(...PDF_COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, 14, y);
    y += 6;
  };

  drawSectionTitle("Consumo por ambiente");
  const envRows = project.environments.map((env) => {
    const envEquipments = project.equipments.filter((eq) => eq.envId === env.id);
    const kwh = envEquipments.reduce((acc, eq) => acc + calcKwh(eq), 0);
    return [
      env.name,
      String(envEquipments.length),
      `${formatNumber(kwh)} kWh`,
      `${formatNumber(totalKwh ? (kwh / totalKwh) * 100 : 0, 1)}%`,
      formatBrl(kwh * effectiveTariff(project)),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Ambiente", "Aparelhos", "Consumo", "Participação", "Custo mensal"]],
    body: envRows,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [...PDF_COLORS.ink] },
    margin: { top: 42, bottom: 23, left: 14, right: 14 },
    didDrawPage: drawHeader,
  });

  const lastTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  y = (lastTable?.finalY ?? y) + 12;
  if (y > 240) {
    doc.addPage();
    drawHeader();
    y = 46;
  }

  drawSectionTitle("Aparelhos · do maior para o menor consumo");
  autoTable(doc, {
    startY: y,
    head: [["Aparelho / modelo", "Ambiente", "Potência", "Uso diário", "kWh/mês", "R$/mês"]],
    body: [...project.equipments]
      .sort((a, b) => calcKwh(b) - calcKwh(a))
      .map((eq) => [
        `${eq.name}\n${eq.qty} unidade(s)${eq.weeklyMinutes ? " • rotina semanal" : ""}`,
        project.environments.find((env) => env.id === eq.envId)?.name ?? "Sem ambiente",
        `${formatNumber(eq.powerW, 0)} W`,
        formatDuration(eq.hours * 60),
        formatNumber(calcKwh(eq)),
        formatBrl(calcKwh(eq) * effectiveTariff(project)),
      ]),
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [...PDF_COLORS.green] },
    columnStyles: { 0: { cellWidth: 61 }, 1: { cellWidth: 28 } },
    margin: { top: 42, bottom: 28, left: 14, right: 14 },
    didDrawPage: drawHeader,
  });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFontSize(7);
    doc.text("Estimativa: potência × quantidade × tempo de uso × dias × fator de uso × tarifa.", 14, 278);
    doc.text("Bandeiras, impostos e uso real podem alterar a fatura. Confirme a potência na etiqueta.", 14, 282);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} · ${p}/${totalPages}`, 14, 288);
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function saveOrShareBlob(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  downloadBlob(blob, filename);
}
