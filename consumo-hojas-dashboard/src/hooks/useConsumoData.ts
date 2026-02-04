import { useEffect, useState } from "react";
import {
  aniosDisponibles,
  Consumo,
  ConsumoRaw,
  Oficina,
  loadCsv,
  normalizeConsumos,
} from "../lib/data";
import { buildAuthHeaders } from "../lib/auth";

type ConsumoState = {
  oficinas: Oficina[];
  consumos: Consumo[];
  loading: boolean;
  anos: string[];
  error?: string;
};

type ConsumoParams = {
  apiBase: string;
  token: string;
  enabled: boolean;
};

export function useConsumoData({ apiBase, token, enabled }: ConsumoParams): ConsumoState {
  const [oficinas, setOficinas] = useState<Oficina[]>([]);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [anos, setAnos] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(undefined);
      if (!enabled) {
        setLoading(false);
        return;
      }
      try {
        const headers = buildAuthHeaders(token);
        const [oficinasCsv, consumosCsv, consumos2026Csv] = await Promise.all([
          loadCsv<Oficina>(`${apiBase}/api/data/oficinas`, { headers }),
          loadCsv<ConsumoRaw>(`${apiBase}/api/data/consumo`, { headers }),
          loadCsv<ConsumoRaw>(`${apiBase}/api/data/consumo_2026`, { headers }),
        ]);

        const consumosNormalizados = normalizeConsumos([
          ...consumosCsv,
          ...consumos2026Csv,
        ]);

        setOficinas(oficinasCsv);
        setConsumos(consumosNormalizados);
        setAnos(aniosDisponibles(consumosNormalizados));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando datos.");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase, token, enabled]);

  return { oficinas, consumos, loading, anos, error };
}
