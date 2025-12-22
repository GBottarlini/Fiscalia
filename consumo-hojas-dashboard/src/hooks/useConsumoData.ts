import { useEffect, useMemo, useState } from "react";
import {
  Consumo,
  ConsumoRaw,
  MESES_2025,
  Oficina,
  loadCsv,
  normalizeConsumos,
} from "../lib/data";

import oficinasUrl from "../data/oficinas.csv?url";
import consumoUrl from "../data/consumo_resmas.csv?url";

type ConsumoState = {
  oficinas: Oficina[];
  consumos: Consumo[];
  loading: boolean;
  meses: string[];
};

export function useConsumoData(): ConsumoState {
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [oficinasCsv, consumosCsv] = await Promise.all([
        loadCsv<Oficina>(oficinasUrl),
        loadCsv<ConsumoRaw>(consumoUrl),
      ]);

      const consumosNormalizados = normalizeConsumos(consumosCsv);

      setOficinas(oficinasCsv);
      setConsumos(consumosNormalizados);
      setLoading(false);
    })();
  }, []);

  const meses = useMemo(() => {
    const usados = new Set(consumos.map((c) => c.mes));
    const presentes = MESES_2025.filter((mes) => usados.has(mes));
    return presentes.length ? presentes : MESES_2025;
  }, [consumos]);

  return { oficinas, consumos, loading, meses };
}
