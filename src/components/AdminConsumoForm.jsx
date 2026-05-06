import { useMemo, useState } from "react";
import { buildAuthHeaders } from "../lib/auth.ts";
import { TIPOS_HOJA } from "../lib/data.ts";
import styles from "./AdminConsumoForm.module.css";

const initialForm = {
  fecha: "",
  codigo_oficina: "",
  tipo_hoja: "A4",
  resmas: "",
};

async function readJsonResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  const text = await res.text();
  if (text.trim().startsWith("<!DOCTYPE")) {
    throw new Error("La API de carga no respondio JSON. Verifica que el backend este corriendo.");
  }
  throw new Error(text || "La API de carga devolvio una respuesta inesperada.");
}

export default function AdminConsumoForm({ apiBase, token, oficinas, onSaved }) {
  const [form, setForm] = useState(initialForm);
  const [allowUpdate, setAllowUpdate] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [saving, setSaving] = useState(false);

  const selectedOffice = useMemo(() => {
    return oficinas.find((oficina) => oficina.codigo_oficina === form.codigo_oficina);
  }, [form.codigo_oficina, oficinas]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setStatus({ type: "", message: "" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus({ type: "", message: "" });

    try {
      const res = await fetch(`${apiBase}/api/data/consumo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(token),
        },
        body: JSON.stringify({
          ...form,
          mes: form.fecha.slice(0, 7),
          mode: allowUpdate ? "update" : "create",
        }),
      });
      const data = await readJsonResponse(res);

      if (!res.ok) {
        throw new Error(data?.error || "No se pudo guardar la carga.");
      }

      setStatus({
        type: "success",
        message:
          data.action === "updated"
            ? "Carga actualizada y dashboard recargado."
            : "Carga guardada y dashboard recargado.",
      });
      setForm((current) => ({
        ...initialForm,
        mes: current.mes,
        fecha: current.fecha,
        tipo_hoja: current.tipo_hoja,
      }));
      setAllowUpdate(false);
      onSaved?.();
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "No se pudo guardar la carga.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="admin-consumo-title">
      <div className={styles.header}>
        <div>
          <h2 id="admin-consumo-title" className={styles.title}>
            Datos de consumo
          </h2>
          <p className={styles.subtitle}>
            Los campos se validan antes de escribir en el CSV correspondiente.
          </p>
        </div>
        {selectedOffice && <div className={styles.meta}>Codigo {selectedOffice.codigo_oficina}</div>}
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.fieldHalf}>
          Fecha
          <input
            className={styles.input}
            type="date"
            value={form.fecha}
            onChange={(event) => updateField("fecha", event.target.value)}
            required
          />
        </label>

        <label className={styles.fieldFull}>
          Oficina
          <select
            className={styles.input}
            value={form.codigo_oficina}
            onChange={(event) => updateField("codigo_oficina", event.target.value)}
            required
          >
            <option value="">Seleccionar oficina</option>
            {oficinas.map((oficina) => (
              <option key={oficina.codigo_oficina} value={oficina.codigo_oficina}>
                {oficina.oficina}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fieldHalf}>
          Tipo
          <select
            className={styles.input}
            value={form.tipo_hoja}
            onChange={(event) => updateField("tipo_hoja", event.target.value)}
            required
          >
            {TIPOS_HOJA.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fieldHalf}>
          Resmas
          <input
            className={styles.input}
            type="number"
            min="0.01"
            step="0.01"
            value={form.resmas}
            onChange={(event) => updateField("resmas", event.target.value)}
            required
          />
        </label>

        <div className={styles.options}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={allowUpdate}
              onChange={(event) => setAllowUpdate(event.target.checked)}
            />
            Actualizar carga existente
          </label>
        </div>

        <button className={styles.button} type="submit" disabled={saving || !oficinas.length}>
          {saving ? "Guardando..." : "Guardar carga"}
        </button>
      </form>

      {status.message && (
        <div className={status.type === "error" ? styles.error : styles.success}>
          {status.message}
        </div>
      )}
    </section>
  );
}
