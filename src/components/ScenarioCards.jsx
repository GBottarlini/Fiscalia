import { useState } from "react";
import { resmasAArboles, resmasALitros } from "../lib/data.ts";
import { formatNumber } from "../lib/format.ts";
import styles from "./ScenarioCards.module.css";

const icon = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3c-3 0-5 2.5-5 5.5 0 1 .2 1.8.6 2.6C8 12 7 13.2 7 14.8 7 17 9 19 12 19s5-2 5-4.2c0-1.6-1-2.8-1.6-3.7.4-.8.6-1.6.6-2.6C16 5.5 14 3 12 3z" fill="#9de3c9" />
    <path d="M12 19v2" stroke="#1f7a5f" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export default function ScenarioCards({ total }) {
  const [reduction, setReduction] = useState(10);
  const factor = 1 - reduction / 100;
  const projected = total * factor;
  const ahorro = total - projected;
  const arboles = resmasAArboles(ahorro);
  const agua = resmasALitros(ahorro);

  return (
    <div className={styles.wrapper}>
      <div className={styles.sectionTitle}>Simulacion interactiva</div>
      <div className={styles.card}>
        <div className={styles.headerRow}>
          <div className={styles.iconBox}>{icon}</div>
          <div>
            <div className={styles.headline}>Reduce el consumo</div>
            <div className={styles.subhead}>Mueve el control y mira el impacto</div>
          </div>
        </div>

        <div className={styles.sliderRow}>
          <input
            className={styles.slider}
            type="range"
            min="0"
            max="30"
            step="1"
            value={reduction}
            onChange={(e) => setReduction(Number(e.target.value))}
          />
          <div className={styles.sliderValue}>{reduction}%</div>
        </div>

        <div className={styles.resultsGrid}>
          <div className={styles.result}>
            <div className={styles.resultLabel}>Ahorro</div>
            <div className={styles.resultValue}>{formatNumber(ahorro, 1)} resmas</div>
          </div>
          <div className={styles.result}>
            <div className={styles.resultLabel}>Arboles</div>
            <div className={styles.resultValue}>{formatNumber(arboles, 1)}</div>
          </div>
          <div className={styles.result}>
            <div className={styles.resultLabel}>Agua</div>
            <div className={styles.resultValue}>{formatNumber(agua, 0)} L</div>
          </div>
          <div className={styles.result}>
            <div className={styles.resultLabel}>Nuevo total</div>
            <div className={styles.resultValue}>{formatNumber(projected, 1)} resmas</div>
          </div>
        </div>
      </div>
    </div>
  );
}
