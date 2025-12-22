import { formatNumber } from "../lib/format.ts";
import styles from "./GoalProgress.module.css";

const statusCopy = {
  ok: { label: "En meta", color: "#2f9b7c" },
  warn: { label: "En riesgo", color: "#f59e0b" },
  danger: { label: "Fuera de meta", color: "#dc2626" },
};

export default function GoalProgress({ monthLabel, current, target, monthsCount }) {
  const ratio = target > 0 ? current / target : 0;
  const delta = current - target;
  const lowUsage = target < 20;
  const statusKey = lowUsage
    ? delta <= 0
      ? "ok"
      : delta <= 3
        ? "warn"
        : "danger"
    : ratio <= 1
      ? "ok"
      : ratio <= 1.15
        ? "warn"
        : "danger";
  const status = statusCopy[statusKey];

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <div className={styles.icon}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="#1f7a5f" strokeWidth="1.6" fill="#e7f8f2" />
            <circle cx="12" cy="12" r="4.5" stroke="#1f7a5f" strokeWidth="1.4" fill="none" />
            <path d="M12 7v3.5l2 1" stroke="#1f7a5f" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div className={styles.title}>Meta del mes</div>
          <div className={styles.subtitle}>{monthLabel}</div>
        </div>
        <span className={styles.status} style={{ color: status.color }}>
          {status.label}
        </span>
      </div>

      <div className={styles.metrics}>
        <div>
          <div className={styles.metricLabel}>Actual</div>
          <div className={styles.metricValue}>{formatNumber(current, 0)} resmas</div>
        </div>
        <div>
          <div className={styles.metricLabel}>Meta</div>
          <div className={styles.metricValue}>{formatNumber(target, 0)} resmas</div>
        </div>
      </div>

      <div className={styles.bar}>
        <div
          className={styles.barFill}
          style={{ width: `${Math.min(ratio, 1.25) * 100}%`, background: status.color }}
        />
      </div>
      <div className={styles.caption}>
        Objetivo sugerido: 10% menos que el promedio mensual ({monthsCount} meses).
        {lowUsage && " En consumos bajos se aplica un margen fijo."}
      </div>
      <div className={styles.delta}>
        Diferencia: {delta >= 0 ? "+" : ""}
        {formatNumber(delta, 0)} resmas
      </div>
    </div>
  );
}
