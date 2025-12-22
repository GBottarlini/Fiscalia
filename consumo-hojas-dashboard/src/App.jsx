import { useMemo, useState } from "react";
import KpiCard from "./components/KpiCard";
import FilterBar from "./components/FilterBar";
import RankingChart from "./components/RankingChart";
import MonthlyTrend from "./components/MonthlyTrend";
import ScenarioCards from "./components/ScenarioCards";
import GoalProgress from "./components/GoalProgress";
import EquivalenceCards from "./components/EquivalenceCards";
import ChatBot from "./components/ChatBot";
import { resmasAArboles, resmasALitros, sumResmas, totalesPorMes, totalesPorOficina } from "./lib/data.ts";
import { useConsumoData } from "./hooks/useConsumoData.ts";
import styles from "./App.module.css";
import { formatNumber } from "./lib/format.ts";

export default function App() {
  const { oficinas, consumos, loading, meses } = useConsumoData();
  const [tipoHoja, setTipoHoja] = useState("TODOS");
  const [oficina, setOficina] = useState("");
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];

  const consumosFiltrados = useMemo(() => {
    return consumos.filter((r) => {
      if (tipoHoja !== "TODOS" && r.tipo_hoja !== tipoHoja) return false;
      if (oficina && r.codigo_oficina !== oficina) return false;
      return true;
    });
  }, [consumos, tipoHoja, oficina]);

  const kpis = useMemo(() => {
    if (!consumosFiltrados.length) return null;

    const totalResmas = sumResmas(consumosFiltrados);
    const promedioMensual = meses.length ? totalResmas / meses.length : 0;

    const ranking = totalesPorOficina(consumosFiltrados);
    const top = ranking[0];
    const nombreTop =
      oficinas.find((o) => o.codigo_oficina === top?.codigo_oficina)?.oficina ??
      top?.codigo_oficina ??
      "-";

    return {
      totalResmas,
      promedioMensual,
      top: { codigo: top?.codigo_oficina, oficina: nombreTop, resmas: top?.total ?? 0 },
      meses: meses.length,
    };
  }, [consumosFiltrados, oficinas, meses]);

  const rankingConNombre = useMemo(() => {
    const base = totalesPorOficina(consumos, {
      tipo_hoja: tipoHoja === "TODOS" ? undefined : tipoHoja,
      oficina: oficina || undefined,
    });
    return base.map((item) => ({
      ...item,
      nombre: oficinas.find((o) => o.codigo_oficina === item.codigo_oficina)?.oficina ?? item.codigo_oficina,
    }));
  }, [consumos, oficinas, tipoHoja, oficina]);

  const serieMensual = useMemo(() => {
    return totalesPorMes(consumosFiltrados, meses);
  }, [consumosFiltrados, meses]);

  const goalData = useMemo(() => {
    if (!serieMensual.length) return null;
    const withData = serieMensual.filter((m) => m.total > 0);
    const baseList = withData.length ? withData : serieMensual;
    const last = baseList[baseList.length - 1];
    const avg =
      baseList.reduce((acc, m) => acc + m.total, 0) / Math.max(baseList.length, 1);
    const target = avg * 0.9;
    const monthIdx = Number(last.mes.split("-")[1]) - 1;
    const monthLabel = `${monthNames[monthIdx] || last.mes} ${last.mes.split("-")[0]}`;
    return { current: last.total, target, monthLabel, monthsCount: baseList.length };
  }, [serieMensual, monthNames]);

  const peakMonth = useMemo(() => {
    if (!serieMensual.length) return null;
    const withData = serieMensual.filter((m) => m.total > 0);
    const baseList = withData.length ? withData : serieMensual;
    const peak = baseList.reduce((acc, item) => (item.total > acc.total ? item : acc), baseList[0]);
    const peakMonthIdx = Number(peak.mes.split("-")[1]) - 1;
    const peakLabel = `${monthNames[peakMonthIdx] || peak.mes} ${peak.mes.split("-")[0]}`;

    return {
      peakLabel,
      peakTotal: peak.total,
    };
  }, [serieMensual, monthNames]);

  const topGlobal = useMemo(() => {
    const lista = totalesPorOficina(consumos);
    const top = lista[0];
    const nombre =
      oficinas.find((o) => o.codigo_oficina === top?.codigo_oficina)?.oficina ??
      top?.codigo_oficina ??
      "-";
    return top ? { ...top, oficina: nombre, resmas: top.total } : null;
  }, [consumos, oficinas]);

  return (
    <div className={styles.shell}>
      <div className={styles.content}>
        <header className={styles.page}>
          <div className={styles.heroCard}>
            <div>
              <h1 className={styles.heroTitle}>Consumo de Hojas 2025</h1>
              <p className={styles.heroSub}>
                Dashboard: Compara oficinas, meses y el impacto en árboles y agua. Usa los filtros y mira el gráfico para detectar picos.
              </p>
            </div>
            <div className={styles.heroBadge}>
              <img className={styles.brandSeal} src="/logofiscalia.png" alt="Fiscalia" />
              <div className={styles.chipRow}>
                <div className={`${styles.chip} ${styles.chipSoftBlue}`}>
                  Año 2025
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className={`${styles.page} ${styles.grid}`}>
          <div id="filtros" />
          <FilterBar
            tipoHoja={tipoHoja}
            onTipoHojaChange={setTipoHoja}
            oficina={oficina}
            onOficinaChange={setOficina}
            oficinas={oficinas}
          />

          {loading && <div className={styles.card}>Cargando datos...</div>}

          {!loading && (
            <>
              <div id="kpis" />
              {kpis ? (
                <div className={styles.grid}>
                  {goalData && (
                    <GoalProgress
                      monthLabel={goalData.monthLabel}
                      current={goalData.current}
                      target={goalData.target}
                      monthsCount={goalData.monthsCount}
                    />
                  )}
                  <EquivalenceCards totalResmas={kpis.totalResmas} />
                  <div className={styles.kpiGrid3}>
                    <KpiCard
                      title="Promedio mensual"
                      value={formatNumber(kpis.promedioMensual, 1)}
                      subtitle={`Meses con datos: ${kpis.meses}`}
                    />
                    <KpiCard
                      title="Top oficina"
                      value={topGlobal?.oficina ?? "-"}
                      subtitle={`${formatNumber(topGlobal?.resmas ?? 0, 0)} resmas`}
                    />
                    <KpiCard
                      title="Mes con mayor consumo"
                      value={peakMonth?.peakLabel ?? "-"}
                      subtitle={
                        peakMonth
                          ? `${formatNumber(peakMonth.peakTotal, 0)} resmas`
                          : "Sin datos suficientes"
                      }
                    />
                  </div>
                  <div className={styles.perforatedDivider} />
                </div>
              ) : (
                <div className={styles.card}>No hay datos para los filtros seleccionados.</div>
              )}

              <div id="charts" className={styles.chartsGrid}>
                <MonthlyTrend data={serieMensual} />
                <RankingChart data={rankingConNombre} />
              </div>

              {kpis && (
                <div id="escenarios" className={styles.grid}>
                  <ScenarioCards total={kpis.totalResmas} />
                  <div className={styles.card}>
                    <div className={styles.sectionTitle}>Resumen ejecutivo</div>
                    <div className={styles.summaryGrid}>
                      <div className={styles.summaryItem}>
                        <div className={styles.summaryLabel}>Consumo actual</div>
                        <div className={styles.summaryValue}>
                          {formatNumber(kpis.totalResmas, 0)} resmas
                        </div>
                      </div>
                      <div className={styles.summaryItem}>
                        <div className={styles.summaryLabel}>Mes con mayor consumo</div>
                        <div className={styles.summaryValue}>
                          {peakMonth?.peakLabel ?? "-"}
                        </div>
                      </div>
                      <div className={styles.summaryItem}>
                        <div className={styles.summaryLabel}>Ahorro posible (10%)</div>
                        <div className={styles.summaryValue}>
                          {formatNumber(kpis.totalResmas * 0.1, 1)} resmas
                        </div>
                        <div className={styles.summarySub}>
                          {formatNumber(resmasAArboles(kpis.totalResmas * 0.1), 1)} árboles,{" "}
                          {formatNumber(resmasALitros(kpis.totalResmas * 0.1), 0)} L
                        </div>
                      </div>
                    </div>
                  </div>
                  <ChatBot
                    context={{
                      filtros: {
                        tipoHoja,
                        oficina: oficina || "Todas",
                      },
                      totalResmas: kpis.totalResmas,
                      promedioMensual: kpis.promedioMensual,
                      topOficinaGlobal: topGlobal?.oficina ?? "-",
                      topResmasGlobal: topGlobal?.resmas ?? 0,
                      mesPico: peakMonth?.peakLabel ?? "-",
                      resmasMesPico: peakMonth?.peakTotal ?? 0,
                    }}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
