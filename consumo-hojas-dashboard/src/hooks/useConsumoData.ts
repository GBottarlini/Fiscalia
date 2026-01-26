import { useEffect, useState } from "react";
import {
  aniosDisponibles,
  Consumo,
  ConsumoRaw,
  Oficina,
  loadCsv,
  normalizeConsumos,
} from "../lib/data";

import oficinasUrl from "../data/oficinas.csv?url";
import consumoUrl from "../data/consumo_resmas.csv?url";
import consumo2026Url from "../data/consumo_resmas_2026.csv?url";

type ConsumoState = {
  oficinas: Oficina[];
  consumos: Consumo[];
  loading: boolean;
  anos: string[];
};

export function useConsumoData(): ConsumoState {
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [anos, setAnos] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [oficinasCsv, consumosCsv, consumos2026Csv] = await Promise.all([
        loadCsv<Oficina>(oficinasUrl),
        loadCsv<ConsumoRaw>(consumoUrl),
        loadCsv<ConsumoRaw>(consumo2026Url),
      ]);

      const consumosNormalizados = normalizeConsumos([
        ...consumosCsv,
        ...consumos2026Csv,
      ]);

      setOficinas(oficinasCsv);
      setConsumos(consumosNormalizados);
      setAnos(aniosDisponibles(consumosNormalizados));
      setLoading(false);
    })();
  }, []);

  return { oficinas, consumos, loading, anos };
}
