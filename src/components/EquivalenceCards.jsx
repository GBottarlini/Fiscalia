import { resmasAArboles, resmasALitros, resmasACo2, resmasAHojas } from "../lib/data.ts";
import { formatNumber } from "../lib/format.ts";
import { useCountUp } from "../hooks/useCountUp.ts";
import styles from "./EquivalenceCards.module.css";

const items = [
  {
    key: "hojas",
    label: "Hojas",
    unit: "",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h8a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z" fill="#e7f8f2" />
        <path d="M9 8h6M9 12h6M9 16h4" stroke="#1e2a3a" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "arboles",
    label: "Arboles",
    unit: "",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3c-3 0-5 2.5-5 5.5 0 1 .2 1.8.6 2.6C8 12 7 13.2 7 14.8 7 17 9 19 12 19s5-2 5-4.2c0-1.6-1-2.8-1.6-3.7.4-.8.6-1.6.6-2.6C16 5.5 14 3 12 3z" fill="#a7e2ce" />
        <path d="M12 19v2" stroke="#1f7a5f" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "agua",
    label: "Agua",
    unit: "L",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3s5 6 5 10.5S15 21 12 21 7 18.5 7 13.5 12 3 12 3z" fill="#b3dcff" />
        <path d="M9.5 15.5c.5.7 1.3 1 2.5 1" stroke="#2b87b5" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "co2",
    label: "CO2",
    unit: "kg",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 14c0 3 3 6 7 6s7-3 7-6-3-6-7-6-7 3-7 6z" fill="#dbe6ea" />
        <path d="M8 13h8" stroke="#5f7183" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function EquivalenceCards({ totalResmas }) {
  const hojas = useCountUp(resmasAHojas(totalResmas), 900);
  const arboles = useCountUp(resmasAArboles(totalResmas), 900);
  const agua = useCountUp(resmasALitros(totalResmas), 900);
  const co2 = useCountUp(resmasACo2(totalResmas), 900);

  const values = {
    hojas: formatNumber(hojas, 0),
    arboles: formatNumber(arboles, 1),
    agua: formatNumber(agua, 0),
    co2: formatNumber(co2, 1),
  };

  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <div key={item.key} className={styles.card}>
          <div className={styles.icon}>{item.icon}</div>
          <div>
            <div className={styles.label}>{item.label}</div>
            <div className={styles.value}>
              {values[item.key]}
              {item.unit ? ` ${item.unit}` : ""}
            </div>
          </div>
        </div>
      ))}
      <div className={styles.footnote}>
        Estimaciones aproximadas basadas en resmas consumidas.
      </div>
    </div>
  );
}
