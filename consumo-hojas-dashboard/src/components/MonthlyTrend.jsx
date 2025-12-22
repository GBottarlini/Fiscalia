import styles from "./MonthlyTrend.module.css";
import { formatNumber } from "../lib/format.ts";

const monthLabels = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export default function MonthlyTrend({ data }) {
  if (!data.length) {
    return (
      <div className={`${styles.card} ${styles.empty}`}>
        <div className={styles.muted}>No hay datos para mostrar la serie.</div>
      </div>
    );
  }

  const max = data.reduce((acc, d) => Math.max(acc, d.total), 1);

  return (
    <div className={styles.card}>
      <div className={styles.title}>Consumo mensual</div>
      <div
        className={styles.chart}
        style={{ "--columns": data.length }}
      >
        {data.map((d) => {
          const h = (d.total / max) * 250; // Use a pixel-based multiplier for the new container height
          const label = d.mes.split("-")[1]; // MM
          const short = monthLabels[Number(label) - 1] || label;
          return (
            <div key={d.mes} className={styles.column}>
              <div className={styles.value}>{formatNumber(d.total, 0)}</div>
              <div
                className={styles.bar}
                style={{ height: Math.max(10, h) }}
                title={`${d.mes}: ${formatNumber(d.total, 0)} resmas`}
              />
              <div className={styles.label}>{short}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
