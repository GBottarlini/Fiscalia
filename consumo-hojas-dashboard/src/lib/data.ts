import Papa from "papaparse";

export type Oficina = {
  codigo_oficina: string;
  oficina: string;
};

export type Consumo = {
  mes: string;
  codigo_oficina: string;
  tipo_hoja: "A4" | "OFICIO";
  resmas: number;
};

export type ConsumoRaw = {
  mes: string;
  codigo_oficina: string;
  tipo_hoja: string;
  resmas: any;
};

export const TIPOS_HOJA = ["A4", "OFICIO"] as const;

export const MESES_2025 = Array.from({ length: 12 }, (_, idx) => {
  const month = String(idx + 1).padStart(2, "0");
  return `2025-${month}`;
});

export const RESMAS_POR_ARBOL = 16.7; // approx: 1 arbol -> ~8330 hojas -> ~16.7 resmas
export const LITROS_POR_RESMA = 5000; // approx: 1 resma ~5000 L de agua en produccion
export const HOJAS_POR_RESMA = 500; // approx: 1 resma -> 500 hojas
export const KG_CO2_POR_RESMA = 2.5; // approx: 1 resma -> 2.5 kg CO2

export async function loadCsv<T>(url: string): Promise<T[]> {
  const res = await fetch(url);
  const text = await res.text();

  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data as T[];
}

export function toNumberSafe(v: any): number {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function resmasAArboles(resmas: number): number {
  return resmas / RESMAS_POR_ARBOL;
}

export function resmasALitros(resmas: number): number {
  return resmas * LITROS_POR_RESMA;
}

export function resmasAHojas(resmas: number): number {
  return resmas * HOJAS_POR_RESMA;
}

export function resmasACo2(resmas: number): number {
  return resmas * KG_CO2_POR_RESMA;
}

export function normalizeConsumos(rows: ConsumoRaw[]): Consumo[] {
  return rows
    .map((row) => {
      const tipo: Consumo["tipo_hoja"] =
        String(row.tipo_hoja || "")
          .trim()
          .toUpperCase() === "OFICIO"
          ? "OFICIO"
          : "A4";

      return {
        mes: row.mes,
        codigo_oficina: row.codigo_oficina,
        tipo_hoja: tipo,
        resmas: toNumberSafe(row.resmas),
      };
    })
    .filter((row) => row.mes && row.codigo_oficina && row.resmas > 0);
}

export function sumResmas(consumos: Consumo[]): number {
  return consumos.reduce((acc, r) => acc + r.resmas, 0);
}

export function totalesPorOficina(
  consumos: Consumo[],
  filtro?: { tipo_hoja?: Consumo["tipo_hoja"]; oficina?: string }
) {
  const mapa = new Map<string, number>();

  for (const r of consumos) {
    if (filtro?.tipo_hoja && r.tipo_hoja !== filtro.tipo_hoja) continue;
    if (filtro?.oficina && r.codigo_oficina !== filtro.oficina) continue;
    mapa.set(r.codigo_oficina, (mapa.get(r.codigo_oficina) || 0) + r.resmas);
  }

  return Array.from(mapa.entries())
    .map(([codigo_oficina, total]) => ({ codigo_oficina, total }))
    .sort((a, b) => b.total - a.total);
}

export function totalesPorMes(
  consumos: Consumo[],
  meses: string[] = MESES_2025,
  filtroTipo?: Consumo["tipo_hoja"]
) {
  const mapa = new Map<string, number>();

  for (const r of consumos) {
    if (filtroTipo && r.tipo_hoja !== filtroTipo) continue;
    mapa.set(r.mes, (mapa.get(r.mes) || 0) + r.resmas);
  }

  return meses.map((mes) => ({
    mes,
    total: mapa.get(mes) || 0,
  }));
}
