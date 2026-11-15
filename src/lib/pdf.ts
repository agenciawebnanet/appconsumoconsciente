import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  avgDailyMinutes,
  calcKwh,
  displayTitle,
  effectiveTariff,
  formatBrl,
  formatDuration,
  formatNumber,
  PROJECT_TYPES,
  simulateKwh,
} from "@/src/lib/energy";
import type { Project } from "@/src/types/energy";

type Rgb = [number, number, number];

const PDF_COLORS: Record<string, Rgb> = {
  ink: [20, 24, 28],
  accent: [240, 174, 0],
  yellow: [255, 214, 10],
  green: [30, 148, 98],
  blue: [72, 138, 224],
  coral: [232, 114, 72],
  red: [215, 68, 68],
  purple: [148, 102, 224],
  muted: [98, 108, 116],
  paper: [255, 255, 255],
  cardBg: [244, 245, 247],
  track: [228, 232, 236],
  border: [215, 220, 226],
};

const SERIES_PALETTE: Rgb[] = [
  PDF_COLORS.accent,
  PDF_COLORS.green,
  PDF_COLORS.blue,
  PDF_COLORS.coral,
  PDF_COLORS.purple,
  PDF_COLORS.muted,
];

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

function clampText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 3 && doc.getTextWidth(`${truncated}...`) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}...`;
}

export function generatePdfReport(
  project: Project,
  sim: Record<string, number> = {}
): Blob {
  const doc = new jsPDF();
  const tariff = effectiveTariff(project);

  const simItems = project.equipments.map((eq) => {
    const origMin = avgDailyMinutes(eq);
    const simMin = sim[eq.id] ?? origMin;
    const origKwh = calcKwh(eq);
    const simKwh = simulateKwh(eq, simMin);
    const changed = Math.abs(simMin - origMin) > 0.05;
    return {
      eq,
      origMin,
      simMin,
      origKwh,
      simKwh,
      origBrl: origKwh * tariff,
      simBrl: simKwh * tariff,
      changed,
    };
  });

  const totalKwh = simItems.reduce((acc, i) => acc + i.origKwh, 0);
  const totalCost = totalKwh * tariff;
  const simTotalKwh = simItems.reduce((acc, i) => acc + i.simKwh, 0);
  const simTotalCost = simTotalKwh * tariff;
  const deltaKwh = totalKwh - simTotalKwh;
  const deltaCost = totalCost - simTotalCost;
  const hasSimChanges = simItems.some((i) => i.changed);
  const deltaPct = totalKwh > 0 ? (deltaKwh / totalKwh) * 100 : 0;

  const drawHeader = () => {
    doc.setFillColor(...PDF_COLORS.ink);
    doc.rect(0, 0, 210, 32, "F");
    doc.setTextColor(...PDF_COLORS.yellow);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("Consumo Consciente", 14, 14);
    doc.setTextColor(...PDF_COLORS.paper);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(
      hasSimChanges
        ? "Relatorio de consumo, graficos e comparativo da simulacao"
        : "Relatorio completo de consumo e graficos de energia",
      14,
      23
    );
    doc.setFontSize(8.5);
    doc.setTextColor(190, 196, 204);
    doc.text(new Date().toLocaleDateString("pt-BR"), 196, 14, { align: "right" });
  };

  drawHeader();

  let y = 42;
  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > 266) {
      doc.addPage();
      drawHeader();
      y = 42;
    }
  };

  const drawSectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(16);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.text(title, 14, y);
    if (subtitle) {
      y += 4.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(subtitle, 14, y);
    }
    y += 6;
  };

  // Project Title & Metadata
  doc.setTextColor(...PDF_COLORS.ink);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(project.name, 182);
  doc.text(nameLines, 14, y);
  y += nameLines.length * 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.muted);
  const typeLabel = PROJECT_TYPES.find(([code]) => code === project.type)?.[1] ?? project.type;
  const subtitle = doc.splitTextToSize(
    `${typeLabel} · ${project.days} dias/mes · Tarifa ${formatBrl(tariff)}/kWh${
      project.state ? ` · ${project.state}` : ""
    }${project.utility ? ` · ${project.utility}` : ""}`,
    182
  );
  doc.text(subtitle, 14, y);
  y += subtitle.length * 4.5 + 5;

  // KPI Row
  const kpis: { label: string; val: string; sub: string; highlight?: Rgb }[] = hasSimChanges
    ? [
        {
          label: "ANTES (ORIGINAL)",
          val: formatBrl(totalCost),
          sub: `${formatNumber(totalKwh, 1)} kWh/mes`,
        },
        {
          label: "DEPOIS (SIMULADO)",
          val: formatBrl(simTotalCost),
          sub: `${formatNumber(simTotalKwh, 1)} kWh/mes`,
          highlight: deltaCost >= 0 ? PDF_COLORS.green : PDF_COLORS.red,
        },
        {
          label: deltaCost >= 0 ? "ECONOMIA MENSAL" : "AUMENTO MENSAL",
          val: `${deltaCost >= 0 ? "-" : "+"}${formatBrl(Math.abs(deltaCost))}`,
          sub: `${deltaPct >= 0 ? "-" : "+"}${formatNumber(Math.abs(deltaPct), 1)}% · ${formatBrl(
            Math.abs(deltaCost) * 12
          )}/ano`,
          highlight: deltaCost >= 0 ? PDF_COLORS.green : PDF_COLORS.red,
        },
      ]
    : [
        {
          label: "CUSTO MENSAL",
          val: formatBrl(totalCost),
          sub: `${formatNumber(totalKwh, 1)} kWh/mes`,
        },
        {
          label: "PROJECAO ANUAL",
          val: formatBrl(totalCost * 12),
          sub: `${formatNumber(totalKwh * 12, 0)} kWh/ano`,
        },
        {
          label: "MEDIA DIARIA",
          val: formatBrl(totalCost / project.days),
          sub: `${formatNumber(totalKwh / project.days, 1)} kWh/dia`,
        },
      ];

  kpis.forEach((kpi, idx) => {
    const x = 14 + idx * 62;
    doc.setFillColor(...PDF_COLORS.cardBg);
    doc.setDrawColor(...PDF_COLORS.border);
    doc.roundedRect(x, y, 58, 25, 2.5, 2.5, "FD");
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(kpi.label, x + 3.5, y + 6.5);
    doc.setTextColor(...(kpi.highlight ?? PDF_COLORS.ink));
    doc.setFontSize(12.5);
    doc.text(kpi.val, x + 3.5, y + 14.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(kpi.sub, x + 3.5, y + 21);
  });
  y += 33;

  // SECTION 1: Simulation Before vs After Chart
  drawSectionTitle(
    "Comparativo da Simulacao: Antes vs. Depois",
    hasSimChanges
      ? `Impacto dos ajustes aplicados em ${simItems.filter((i) => i.changed).length} aparelho(s)`
      : "Cenario base (sem ajustes ativos na aba Simular — valores iguais)"
  );

  ensureSpace(34);
  doc.setFillColor(...PDF_COLORS.cardBg);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.roundedRect(14, y, 182, 28, 2.5, 2.5, "FD");

  const globalMax = Math.max(0.1, totalKwh, simTotalKwh);
  const barTrackX = 52;
  const barTrackW = 92;

  // Before global bar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_COLORS.ink);
  doc.text("Antes (Original)", 18, y + 10);
  doc.setFillColor(...PDF_COLORS.track);
  doc.roundedRect(barTrackX, y + 6, barTrackW, 5.5, 1.5, 1.5, "F");
  doc.setFillColor(...PDF_COLORS.coral);
  doc.roundedRect(
    barTrackX,
    y + 6,
    Math.max(3, (totalKwh / globalMax) * barTrackW),
    5.5,
    1.5,
    1.5,
    "F"
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `${formatNumber(totalKwh, 1)} kWh · ${formatBrl(totalCost)}`,
    192,
    y + 10,
    { align: "right" }
  );

  // After global bar
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(deltaCost >= 0 ? PDF_COLORS.green : PDF_COLORS.red));
  doc.text("Depois (Simulado)", 18, y + 20.5);
  doc.setFillColor(...PDF_COLORS.track);
  doc.roundedRect(barTrackX, y + 16.5, barTrackW, 5.5, 1.5, 1.5, "F");
  doc.setFillColor(...(deltaCost >= 0 ? PDF_COLORS.green : PDF_COLORS.red));
  doc.roundedRect(
    barTrackX,
    y + 16.5,
    Math.max(3, (simTotalKwh / globalMax) * barTrackW),
    5.5,
    1.5,
    1.5,
    "F"
  );
  doc.setFont("helvetica", "bold");
  doc.text(
    `${formatNumber(simTotalKwh, 1)} kWh · ${formatBrl(simTotalCost)}`,
    192,
    y + 20.5,
    { align: "right" }
  );
  y += 35;

  // Grouped Before vs After chart by top/adjusted appliances
  const topComparison = [...simItems]
    .sort((a, b) => {
      if (a.changed !== b.changed) return a.changed ? -1 : 1;
      return Math.max(b.origKwh, b.simKwh) - Math.max(a.origKwh, a.simKwh);
    })
    .slice(0, 8);

  if (topComparison.length > 0) {
    const rowH = 12.5;
    const chartH = 12 + topComparison.length * rowH;
    ensureSpace(chartH + 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text("Grafico: Antes vs. Depois por Aparelho (kWh/mes)", 14, y);

    // Legend
    doc.setFillColor(...PDF_COLORS.coral);
    doc.rect(142, y - 3, 3.5, 3.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_COLORS.muted);
    doc.text("Antes", 147, y);
    doc.setFillColor(...PDF_COLORS.green);
    doc.rect(164, y - 3, 3.5, 3.5, "F");
    doc.text("Depois", 169, y);
    y += 5;

    const maxEqKwh = Math.max(
      0.1,
      ...topComparison.map((i) => Math.max(i.origKwh, i.simKwh))
    );

    topComparison.forEach((item) => {
      const label = clampText(doc, displayTitle(item.eq.name), 48);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.ink);
      doc.text(label, 14, y + 4.5);

      const xBar = 66;
      const wBar = 78;
      // Antes bar
      doc.setFillColor(...PDF_COLORS.track);
      doc.rect(xBar, y + 0.5, wBar, 3.2, "F");
      doc.setFillColor(...PDF_COLORS.coral);
      doc.rect(xBar, y + 0.5, Math.max(2, (item.origKwh / maxEqKwh) * wBar), 3.2, "F");

      // Depois bar
      doc.setFillColor(...PDF_COLORS.track);
      doc.rect(xBar, y + 4.7, wBar, 3.2, "F");
      doc.setFillColor(...(item.simKwh > item.origKwh ? PDF_COLORS.red : PDF_COLORS.green));
      doc.rect(xBar, y + 4.7, Math.max(2, (item.simKwh / maxEqKwh) * wBar), 3.2, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...PDF_COLORS.muted);
      const pctDiff =
        item.origKwh > 0 ? ((item.simKwh - item.origKwh) / item.origKwh) * 100 : 0;
      const valText = `${formatNumber(item.origKwh, 1)} -> ${formatNumber(item.simKwh, 1)} kWh (${
        pctDiff > 0 ? "+" : ""
      }${formatNumber(pctDiff, 0)}%)`;
      doc.text(valText, 196, y + 5.8, { align: "right" });

      y += rowH;
    });
    y += 5;
  }

  // SECTION 2: Weekly Column Chart
  const weeklyData = WEEK_DAYS.map((day, dayIdx) => {
    const orig = project.equipments.reduce((acc, eq) => {
      if (eq.monthlyKwh != null) return acc + calcKwh(eq) / project.days;
      const dayHours =
        eq.weeklyMinutes?.[dayIdx] == null
          ? eq.hours * eq.factor
          : (eq.weeklyMinutes[dayIdx] ?? 0) / 60;
      return acc + (eq.powerW / 1000) * eq.qty * dayHours;
    }, 0);

    const simVal = simItems.reduce((acc, item) => {
      if (item.changed) {
        return acc + (item.simKwh / Math.max(1, item.eq.days));
      }
      if (item.eq.monthlyKwh != null) return acc + item.origKwh / project.days;
      const dayHours =
        item.eq.weeklyMinutes?.[dayIdx] == null
          ? item.eq.hours * item.eq.factor
          : (item.eq.weeklyMinutes[dayIdx] ?? 0) / 60;
      return acc + (item.eq.powerW / 1000) * item.eq.qty * dayHours;
    }, 0);

    return { day, orig, simVal };
  });

  drawSectionTitle(
    "Grafico: Rotina Semanal Estimada (kWh/dia)",
    hasSimChanges
      ? "Comparativo diario entre o uso original e o uso simulado"
      : "Distribuicao diaria da semana com base nos horarios cadastrados"
  );

  ensureSpace(56);
  const chartBoxY = y;
  const chartBoxH = 48;
  doc.setFillColor(...PDF_COLORS.cardBg);
  doc.setDrawColor(...PDF_COLORS.border);
  doc.roundedRect(14, chartBoxY, 182, chartBoxH, 2.5, 2.5, "FD");

  const plotBottom = chartBoxY + 38;
  const plotH = 26;
  const maxWeekKwh = Math.max(0.1, ...weeklyData.map((d) => Math.max(d.orig, d.simVal)));

  // Gridlines
  doc.setDrawColor(...PDF_COLORS.border);
  [0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const gy = plotBottom - ratio * plotH;
    doc.line(20, gy, 190, gy);
  });

  const colSpacing = 166 / 7;
  weeklyData.forEach((d, idx) => {
    const cx = 24 + idx * colSpacing + colSpacing / 2;
    const hOrig = Math.max(1.5, (d.orig / maxWeekKwh) * plotH);
    if (hasSimChanges) {
      const hSim = Math.max(1.5, (d.simVal / maxWeekKwh) * plotH);
      doc.setFillColor(...PDF_COLORS.coral);
      doc.rect(cx - 5.5, plotBottom - hOrig, 5, hOrig, "F");
      doc.setFillColor(...(d.simVal > d.orig ? PDF_COLORS.red : PDF_COLORS.green));
      doc.rect(cx + 0.5, plotBottom - hSim, 5, hSim, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...PDF_COLORS.muted);
      doc.text(
        `${formatNumber(d.orig, 1)}/${formatNumber(d.simVal, 1)}`,
        cx,
        plotBottom - Math.max(hOrig, hSim) - 1.5,
        { align: "center" }
      );
    } else {
      doc.setFillColor(...PDF_COLORS.green);
      doc.rect(cx - 4.5, plotBottom - hOrig, 9, hOrig, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.ink);
      doc.text(formatNumber(d.orig, 1), cx, plotBottom - hOrig - 1.8, { align: "center" });
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_COLORS.ink);
    doc.text(d.day, cx, chartBoxY + 44, { align: "center" });
  });
  y += chartBoxH + 8;

  // SECTION 3: Category Breakdown Chart
  const catTotals = [...new Set(project.equipments.map((eq) => eq.category))]
    .map((category) => {
      const catItems = simItems.filter((i) => i.eq.category === category);
      return {
        category,
        origKwh: catItems.reduce((acc, i) => acc + i.origKwh, 0),
        simKwh: catItems.reduce((acc, i) => acc + i.simKwh, 0),
      };
    })
    .sort((a, b) => b.origKwh - a.origKwh);

  if (catTotals.length > 0) {
    const displayCats =
      catTotals.length <= 6
        ? catTotals
        : [
            ...catTotals.slice(0, 5),
            {
              category: "Outros",
              origKwh: catTotals.slice(5).reduce((a, b) => a + b.origKwh, 0),
              simKwh: catTotals.slice(5).reduce((a, b) => a + b.simKwh, 0),
            },
          ];

    drawSectionTitle("Grafico: Participacao por Categoria");
    ensureSpace(16 + displayCats.length * 8);

    // Stacked proportional bar
    let sx = 14;
    const totalW = 182;
    displayCats.forEach((cat, idx) => {
      const w = totalKwh > 0 ? (cat.origKwh / totalKwh) * totalW : totalW / displayCats.length;
      doc.setFillColor(...SERIES_PALETTE[idx % SERIES_PALETTE.length]);
      doc.rect(sx, y, Math.max(0.8, w), 6, "F");
      sx += w;
    });
    y += 10;

    displayCats.forEach((cat, idx) => {
      const pct = totalKwh > 0 ? (cat.origKwh / totalKwh) * 100 : 0;
      const color = SERIES_PALETTE[idx % SERIES_PALETTE.length];
      doc.setFillColor(...color);
      doc.rect(14, y - 2.8, 3.2, 3.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...PDF_COLORS.ink);
      doc.text(clampText(doc, cat.category, 64), 20, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_COLORS.muted);
      const labelRight = hasSimChanges
        ? `${formatNumber(cat.origKwh, 1)} -> ${formatNumber(cat.simKwh, 1)} kWh (${formatNumber(
            pct,
            1
          )}%) · ${formatBrl(cat.simKwh * tariff)}`
        : `${formatNumber(cat.origKwh, 1)} kWh (${formatNumber(pct, 1)}%) · ${formatBrl(
            cat.origKwh * tariff
          )}`;
      doc.text(labelRight, 196, y, { align: "right" });
      y += 6.5;
    });
    y += 4;
  }

  // SECTION 4: Environment Horizontal Bar Chart
  const envStats = project.environments
    .map((env) => {
      const envItems = simItems.filter((i) => i.eq.envId === env.id);
      const origKwh = envItems.reduce((acc, i) => acc + i.origKwh, 0);
      const simKwh = envItems.reduce((acc, i) => acc + i.simKwh, 0);
      return { env, count: envItems.length, origKwh, simKwh };
    })
    .sort((a, b) => b.origKwh - a.origKwh);

  if (envStats.length > 0) {
    const chartEnvs = envStats.slice(0, 10);
    drawSectionTitle(
      `Grafico: Consumo por Ambiente${envStats.length > 10 ? " (Top 10)" : ""}`,
      hasSimChanges ? "Comparacao Antes vs. Depois por ambiente" : undefined
    );

    const maxEnvKwh = Math.max(
      0.1,
      ...chartEnvs.map((e) => Math.max(e.origKwh, e.simKwh))
    );
    const rowH = hasSimChanges ? 11 : 8;
    ensureSpace(chartEnvs.length * rowH + 6);

    chartEnvs.forEach((e) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_COLORS.ink);
      doc.text(clampText(doc, e.env.name, 45), 14, y + 3.5);

      const xB = 62;
      const wB = 82;
      if (hasSimChanges) {
        doc.setFillColor(...PDF_COLORS.track);
        doc.rect(xB, y, wB, 3, "F");
        doc.setFillColor(...PDF_COLORS.coral);
        doc.rect(xB, y, Math.max(1.5, (e.origKwh / maxEnvKwh) * wB), 3, "F");

        doc.setFillColor(...PDF_COLORS.track);
        doc.rect(xB, y + 4, wB, 3, "F");
        doc.setFillColor(...(e.simKwh > e.origKwh ? PDF_COLORS.red : PDF_COLORS.green));
        doc.rect(xB, y + 4, Math.max(1.5, (e.simKwh / maxEnvKwh) * wB), 3, "F");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...PDF_COLORS.muted);
        doc.text(
          `${formatNumber(e.origKwh, 1)} -> ${formatNumber(e.simKwh, 1)} kWh`,
          196,
          y + 5.2,
          { align: "right" }
        );
      } else {
        doc.setFillColor(...PDF_COLORS.track);
        doc.rect(xB, y + 0.5, wB, 4, "F");
        doc.setFillColor(...PDF_COLORS.accent);
        doc.rect(xB, y + 0.5, Math.max(1.5, (e.origKwh / maxEnvKwh) * wB), 4, "F");
        const pct = totalKwh > 0 ? (e.origKwh / totalKwh) * 100 : 0;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...PDF_COLORS.muted);
        doc.text(
          `${formatNumber(e.origKwh, 1)} kWh (${formatNumber(pct, 0)}%)`,
          196,
          y + 3.8,
          { align: "right" }
        );
      }
      y += rowH;
    });
    y += 5;
  }

  // SECTION 5: Adjusted Appliances Table (if any adjustments exist)
  const changedItems = simItems.filter((i) => i.changed);
  if (changedItems.length > 0) {
    ensureSpace(30);
    drawSectionTitle("Tabela Comparativa da Simulacao (Aparelhos Ajustados)");
    autoTable(doc, {
      startY: y,
      head: [["Aparelho", "Uso Antes", "Uso Depois", "kWh Antes -> Depois", "R$ Antes -> Depois", "Diferenca"]],
      body: changedItems.map((i) => {
        const diffBrl = i.origBrl - i.simBrl;
        const pct = i.origKwh > 0 ? ((i.simKwh - i.origKwh) / i.origKwh) * 100 : 0;
        return [
          displayTitle(i.eq.name),
          `${formatDuration(i.origMin)}/dia`,
          `${formatDuration(i.simMin)}/dia`,
          `${formatNumber(i.origKwh, 1)} -> ${formatNumber(i.simKwh, 1)}`,
          `${formatBrl(i.origBrl)} -> ${formatBrl(i.simBrl)}`,
          `${diffBrl >= 0 ? "-" : "+"}${formatBrl(Math.abs(diffBrl))} (${pct > 0 ? "+" : ""}${formatNumber(
            pct,
            0
          )}%)`,
        ];
      }),
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 2.8, overflow: "linebreak" },
      headStyles: { fillColor: [...PDF_COLORS.green] },
      margin: { top: 38, bottom: 26, left: 14, right: 14 },
      didDrawPage: drawHeader,
    });
    const lastTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    y = (lastTable?.finalY ?? y) + 10;
  }

  // SECTION 6: Environment Table
  ensureSpace(30);
  drawSectionTitle("Detalhamento por ambiente");
  const envHead = hasSimChanges
    ? [["Ambiente", "Qtd", "Antes (kWh)", "Depois (kWh)", "Custo Antes", "Custo Depois"]]
    : [["Ambiente", "Aparelhos", "Consumo", "Participacao", "Custo mensal"]];

  const envRows = envStats.map((e) =>
    hasSimChanges
      ? [
          e.env.name,
          String(e.count),
          `${formatNumber(e.origKwh, 1)} kWh`,
          `${formatNumber(e.simKwh, 1)} kWh`,
          formatBrl(e.origKwh * tariff),
          formatBrl(e.simKwh * tariff),
        ]
      : [
          e.env.name,
          String(e.count),
          `${formatNumber(e.origKwh)} kWh`,
          `${formatNumber(totalKwh ? (e.origKwh / totalKwh) * 100 : 0, 1)}%`,
          formatBrl(e.origKwh * tariff),
        ]
  );

  autoTable(doc, {
    startY: y,
    head: envHead,
    body: envRows,
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 2.8, overflow: "linebreak" },
    headStyles: { fillColor: [...PDF_COLORS.ink] },
    margin: { top: 38, bottom: 26, left: 14, right: 14 },
    didDrawPage: drawHeader,
  });

  const lastEnvTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  y = (lastEnvTable?.finalY ?? y) + 10;

  // SECTION 7: Appliances Table
  ensureSpace(32);
  drawSectionTitle("Aparelhos · do maior para o menor consumo");
  const eqHead = hasSimChanges
    ? [["Aparelho / modelo", "Ambiente", "Potencia", "Antes", "Simulado", "Economia"]]
    : [["Aparelho / modelo", "Ambiente", "Potencia", "Uso diario", "kWh/mes", "R$/mes"]];

  const eqBody = [...simItems]
    .sort((a, b) => b.origKwh - a.origKwh)
    .map((item) => {
      const envName =
        project.environments.find((env) => env.id === item.eq.envId)?.name ?? "Sem ambiente";
      if (hasSimChanges) {
        const diff = item.origBrl - item.simBrl;
        return [
          `${item.eq.name}\n${item.eq.qty} un.`,
          envName,
          `${formatNumber(item.eq.powerW, 0)} W`,
          `${formatNumber(item.origKwh, 1)} kWh\n${formatBrl(item.origBrl)}`,
          `${formatNumber(item.simKwh, 1)} kWh\n${formatBrl(item.simBrl)}`,
          item.changed
            ? `${diff >= 0 ? "-" : "+"}${formatBrl(Math.abs(diff))}`
            : "Sem ajuste",
        ];
      }
      return [
        `${item.eq.name}\n${item.eq.qty} unidade(s)${item.eq.weeklyMinutes ? " · rotina semanal" : ""}`,
        envName,
        `${formatNumber(item.eq.powerW, 0)} W`,
        formatDuration(item.eq.hours * 60),
        formatNumber(item.origKwh),
        formatBrl(item.origBrl),
      ];
    });

  autoTable(doc, {
    startY: y,
    head: eqHead,
    body: eqBody,
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 2.8, overflow: "linebreak" },
    headStyles: { fillColor: [...PDF_COLORS.green] },
    columnStyles: hasSimChanges
      ? { 0: { cellWidth: 52 }, 1: { cellWidth: 26 } }
      : { 0: { cellWidth: 61 }, 1: { cellWidth: 28 } },
    margin: { top: 38, bottom: 28, left: 14, right: 14 },
    didDrawPage: drawHeader,
  });

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_COLORS.muted);
    doc.setFontSize(7);
    doc.text(
      "Estimativa: potencia x quantidade x tempo de uso x dias x fator de uso x tarifa.",
      14,
      278
    );
    doc.text(
      "Bandeiras, impostos e uso real podem alterar a fatura. Confirme a potencia na etiqueta.",
      14,
      282
    );
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
