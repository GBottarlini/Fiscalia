import styles from "./FilterBar.module.css";

export default function FilterBar({
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
