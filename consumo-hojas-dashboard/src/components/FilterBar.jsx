import styles from "./FilterBar.module.css";

export default function FilterBar({
  ano,
  anos,
  onAnoChange,
  tipoHoja,
  onTipoHojaChange,
  oficina,
  onOficinaChange,
  oficinas,
}) {
  return (
    <div className={styles.card}>
      <div className={styles.row}>
        <div className={styles.field}>
          <div className={styles.label}>
            Año
          </div>
          <select
            className={styles.select}
            value={ano}
            onChange={(e) => onAnoChange(e.target.value)}
          >
            {anos.length ? (
              anos.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))
            ) : (
              <option value="">Sin datos</option>
            )}
          </select>
        </div>
        <div className={styles.field}>
          <div className={styles.label}>
            Tipo de hoja
          </div>
          <select
            className={styles.select}
            value={tipoHoja}
            onChange={(e) => onTipoHojaChange(e.target.value)}
          >
            <option value="TODOS">Todos</option>
            <option value="A4">A4</option>
            <option value="OFICIO">Oficio</option>
          </select>
        </div>
        <div className={`${styles.field} ${styles.fieldWide}`}>
          <div className={styles.label}>
            Oficina
          </div>
          <select
            className={styles.select}
            value={oficina}
            onChange={(e) => onOficinaChange(e.target.value)}
          >
            <option value="">Todas</option>
            {oficinas.map((o) => (
              <option key={o.codigo_oficina} value={o.codigo_oficina}>
                {o.oficina}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
