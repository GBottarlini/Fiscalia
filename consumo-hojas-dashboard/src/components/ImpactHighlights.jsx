import { resmasAArboles, resmasALitros } from "../lib/data.ts";
import KpiCard from "./KpiCard";
import styles from "./ImpactHighlights.module.css";
import { formatNumber } from "../lib/format.ts";

export default function ImpactHighlights({ totalResmas, topGlobal }) {
  const arboles = resmasAArboles(totalResmas);
  const agua = resmasALitros(totalResmas);
  const topLabel =
    topGlobal && topGlobal.oficina
      ? topGlobal.oficina
      : topGlobal?.codigo_oficina || "-";
  const topResmas = Math.round(topGlobal?.resmas || topGlobal?.total || 0);

  return (
    <div className={styles.grid}>
      <KpiCard
        title="Huella en agua"
        value={`${formatNumber(agua, 0)} L`}
        subtitle="Producción estimada de papel (1 resma ~ 5000 L)"
      />
      <KpiCard
        title="Árboles estimados"
        value={formatNumber(arboles, 1)}
        subtitle="1 árbol ~ 16.7 resmas"
      />
      <KpiCard
        title="Resmas totales"
        value={formatNumber(totalResmas, 0)}
        subtitle="Consumo anual con filtros aplicados"
      />
      <KpiCard
        title="Oficina que más tala (global)"
        value={topLabel}
        subtitle={`${formatNumber(topResmas, 0)} resmas`}
      />
    </div>
  );
}
