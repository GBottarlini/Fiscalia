import { useEffect, useState } from "react";
import styles from "./RankingChart.module.css";
import { formatNumber } from "../lib/format.ts";

export default function RankingChart({ data, maxItems = 10 }) {
  const [page, setPage] = useState(0);
  const itemsPerPage = Math.min(4, maxItems);

  useEffect(() => {
    setPage(0);
  }, [data]);

  const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
  const start = page * itemsPerPage;
  const visible = data.slice(start, start + itemsPerPage);
  const maxVal = data.reduce((acc, item) => Math.max(acc, item.total), 1);

  return (
    <div className={styles.card}>
      <div className={styles.title}>Ranking de consumo</div>

      <div className={styles.list}>
        {visible.map((item, idx) => {
          const width = Math.max(8, Math.round((item.total / maxVal) * 100));
          return (
            <div key={item.codigo_oficina}>
              <div className={styles.itemRow}>
                <div className={styles.rowLeft}>
                  <span className={styles.rankChip}>
                    #{start + idx + 1}
                  </span>
                  <div>
                    <div className={styles.name}>{item.nombre}</div>
                    <div className={styles.muted}>
                      Codigo {item.codigo_oficina}
                    </div>
                  </div>
                </div>
                <div className={styles.total}>{formatNumber(item.total, 0)} resmas</div>
              </div>
              <div className={styles.bar}>
                <div className={styles.barFill} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
        {!visible.length && (
          <div className={styles.empty}>
            <div className={styles.muted}>No hay datos con los filtros actuales.</div>
          </div>
        )}
      </div>

      {data.length > itemsPerPage && (
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.pagerButton}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            {"<"}
          </button>
          <span className={styles.muted}>
            {page + 1}/{totalPages}
          </span>
          <button
            type="button"
            className={styles.pagerButton}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            {">"}
          </button>
        </div>
      )}
    </div>
  );
}
