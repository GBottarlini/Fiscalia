import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Papa from "papaparse";

export const CONSUMO_HEADERS = [
  "fecha",
  "mes",
  "oficina",
  "codigo_oficina",
  "tipo_hoja",
  "resmas",
];

function normalizeOrigin(origin) {
  return String(origin || "").trim().replace(/\/+$/, "");
}

function parseCsv(csv, filename) {
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    throw new Error(`Invalid CSV ${filename}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
}

function consumoFilenameForMes(mes) {
  const year = Number(String(mes).slice(0, 4));
  return year >= 2026 ? "consumo_resmas_2026.csv" : "consumo_resmas.csv";
}

function validateConsumoPayload(body, oficinas) {
  const fechaInput = String(body?.fecha || "").trim();
  const mes = String(body?.mes || (fechaInput ? fechaInput.slice(0, 7) : "")).trim();
  const codigoOficina = String(body?.codigo_oficina || "").trim();
  const tipoHoja = String(body?.tipo_hoja || "").trim().toUpperCase();
  const resmas = Number(String(body?.resmas ?? "").replace(",", "."));
  const mode = String(body?.mode || "create").trim();

  if (!/^\d{4}-\d{2}$/.test(mes)) return { error: "El mes debe tener formato YYYY-MM." };
  const month = Number(mes.slice(5, 7));
  if (month < 1 || month > 12) return { error: "El mes debe estar entre 01 y 12." };
  if (!codigoOficina) return { error: "Falta codigo_oficina." };
  const oficina = oficinas.find((item) => String(item.codigo_oficina).trim() === codigoOficina);
  if (!oficina) return { error: "La oficina no existe en oficinas.csv." };
  if (!["A4", "OFICIO"].includes(tipoHoja)) return { error: "tipo_hoja debe ser A4 u OFICIO." };
  if (!Number.isFinite(resmas) || resmas <= 0) {
    return { error: "resmas debe ser un numero mayor a 0." };
  }
  if (!fechaInput) return { error: "Falta fecha." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInput)) {
    return { error: "La fecha debe tener formato YYYY-MM-DD." };
  }
  if (!fechaInput.startsWith(`${mes}-`)) {
    return { error: "La fecha debe pertenecer al mes informado." };
  }
  if (!["create", "update"].includes(mode)) return { error: "mode debe ser create o update." };

  return {
    value: {
      fecha: fechaInput,
      mes,
      oficina: oficina.oficina,
      codigo_oficina: oficina.codigo_oficina,
      tipo_hoja: tipoHoja,
      resmas: String(resmas),
      mode,
    },
  };
}

export function createApp({ storage, env = process.env }) {
  if (!storage) throw new Error("A CSV storage adapter is required.");

  const app = express();
  const defaultCorsOrigins = ["http://localhost:5173"];
  const corsOrigins = (env.CORS_ORIGIN || defaultCorsOrigins.join(","))
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
  const allowedCorsOrigins = new Set(corsOrigins);
  const allowAnyCorsOrigin = allowedCorsOrigins.has("*");
  const corsOptions = {
    origin(origin, callback) {
      callback(null, !origin || allowAnyCorsOrigin || allowedCorsOrigins.has(normalizeOrigin(origin)));
    },
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "OPTIONS"],
    optionsSuccessStatus: 204,
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));

  function verifyPassword(password) {
    if (!env.ADMIN_PASSWORD_HASH) return false;
    const [salt, hash] = env.ADMIN_PASSWORD_HASH.split(":");
    if (!salt || !hash) return false;
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
  }

  function requireAuth(req, res, next) {
    if (!env.JWT_SECRET) {
      res.status(500).json({ error: "Missing JWT_SECRET" });
      return;
    }
    const [scheme, token] = (req.get("Authorization") || "").split(" ");
    if (scheme !== "Bearer" || !token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    try {
      req.user = jwt.verify(token, env.JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  }

  async function sendCsv(res, filename) {
    const { data } = await storage.read(filename);
    res.set("Cache-Control", "no-store, max-age=0");
    res.type("text/csv").send(data);
  }

  app.get("/api/health", async (_req, res) => {
    try {
      await storage.ensureAll();
      res.set("Cache-Control", "no-store");
      res.json({
        ok: true,
        service: env.SITE_NAME || "local",
        commit: env.COMMIT_REF || null,
        storage: storage.kind,
      });
    } catch {
      res.status(503).json({ ok: false, error: "CSV storage is not available" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH || !env.JWT_SECRET) {
      res.status(500).json({ error: "Auth not configured" });
      return;
    }
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: "Missing credentials" });
      return;
    }
    if (String(email).toLowerCase() !== env.ADMIN_EMAIL.toLowerCase() || !verifyPassword(String(password))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = jwt.sign({ role: "admin", email: env.ADMIN_EMAIL }, env.JWT_SECRET, { expiresIn: "8h" });
    res.json({ token });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => res.json({ user: req.user }));

  app.get("/api/data/oficinas", requireAuth, async (_req, res) => {
    try {
      await sendCsv(res, "oficinas.csv");
    } catch (error) {
      res.status(500).json({ error: "Failed to read oficinas CSV", detail: String(error) });
    }
  });

  app.get("/api/data/consumo", requireAuth, async (_req, res) => {
    try {
      await sendCsv(res, "consumo_resmas.csv");
    } catch (error) {
      res.status(500).json({ error: "Failed to read consumo CSV", detail: String(error) });
    }
  });

  app.get("/api/data/consumo_2026", requireAuth, async (_req, res) => {
    try {
      await sendCsv(res, "consumo_resmas_2026.csv");
    } catch (error) {
      res.status(500).json({ error: "Failed to read consumo 2026 CSV", detail: String(error) });
    }
  });

  app.post("/api/data/consumo", requireAuth, async (req, res) => {
    try {
      const oficinasCsv = await storage.read("oficinas.csv");
      const validation = validateConsumoPayload(req.body, parseCsv(oficinasCsv.data, "oficinas.csv"));
      if (validation.error) {
        res.status(400).json({ error: validation.error });
        return;
      }

      const { mode, ...entry } = validation.value;
      const filename = consumoFilenameForMes(entry.mes);
      const current = await storage.read(filename);
      const rows = parseCsv(current.data, filename);
      const duplicateIndex = rows.findIndex(
        (row) =>
          String(row.mes).trim() === entry.mes &&
          String(row.codigo_oficina).trim() === entry.codigo_oficina &&
          String(row.tipo_hoja).trim().toUpperCase() === entry.tipo_hoja
      );

      if (duplicateIndex >= 0 && mode !== "update") {
        res.status(409).json({
          error: "Ya existe una carga para ese mes, oficina y tipo de hoja.",
          code: "DUPLICATE_CONSUMO",
        });
        return;
      }

      if (duplicateIndex >= 0) rows[duplicateIndex] = entry;
      else rows.push(entry);
      const csv = `${Papa.unparse(rows, { columns: CONSUMO_HEADERS, header: true })}\n`;
      const result = await storage.replace(filename, csv, {
        etag: current.etag,
        previousData: current.data,
      });

      if (result.readOnly) {
        res.status(409).json({
          error: "CSV writes are disabled outside the production deploy context.",
          code: "CSV_STORAGE_READ_ONLY",
        });
        return;
      }
      if (!result.modified) {
        res.status(409).json({
          error: "The CSV changed while this request was being processed. Reload and try again.",
          code: "CSV_WRITE_CONFLICT",
        });
        return;
      }

      res.status(duplicateIndex >= 0 ? 200 : 201).json({
        ok: true,
        action: duplicateIndex >= 0 ? "updated" : "created",
        filename,
        entry,
        storage: storage.kind,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to write consumo CSV", detail: String(error) });
    }
  });

  app.post("/api/chat", requireAuth, async (req, res) => {
    if (!env.OPENAI_API_KEY) {
      res.status(500).json({ error: "Missing OPENAI_API_KEY" });
      return;
    }
    const { question, context } = req.body || {};
    if (!question || typeof question !== "string") {
      res.status(400).json({ error: "Missing question" });
      return;
    }
    const system = [
      "Eres un asistente del dashboard de consumo de hojas.",
      "Tu nombre es Fisqui y puedes presentarte si te preguntan.",
      "Responde en español, claro y breve (2-4 frases).",
      "Usa los datos del contexto cuando estén disponibles.",
      "Si falta un dato, dilo y sugiere qué filtro revisar.",
    ].join(" ");
    const userPayload = [
      "Contexto del dashboard:",
      JSON.stringify(context || {}, null, 2),
      "",
      "Pregunta:",
      question,
    ].join("\n");

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.3,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userPayload },
          ],
        }),
      });
      if (!response.ok) {
        res.status(500).json({ error: "OpenAI request failed", detail: await response.text() });
        return;
      }
      const data = await response.json();
      const answer = data?.choices?.[0]?.message?.content?.trim();
      res.json({ answer: answer || "No pude generar una respuesta." });
    } catch (error) {
      res.status(500).json({ error: "Unexpected error", detail: String(error) });
    }
  });

  return app;
}
