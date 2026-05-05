import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import Papa from "papaparse";

const app = express();
const port = process.env.PORT || 3001;
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: corsOrigin,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.use(express.json({ limit: "1mb" }));

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;
const dataDir = path.resolve(process.cwd(), "src", "data");
const CONSUMO_HEADERS = ["fecha", "mes", "oficina", "codigo_oficina", "tipo_hoja", "resmas"];

function verifyPassword(password) {
  if (!ADMIN_PASSWORD_HASH) return false;
  const [salt, hash] = ADMIN_PASSWORD_HASH.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

function signToken(email) {
  if (!JWT_SECRET) return "";
  return jwt.sign({ role: "admin", email }, JWT_SECRET, { expiresIn: "8h" });
}

function requireAuth(req, res, next) {
  if (!JWT_SECRET) {
    res.status(500).json({ error: "Missing JWT_SECRET" });
    return;
  }
  const header = req.get("Authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/login", (req, res) => {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH || !JWT_SECRET) {
    res.status(500).json({ error: "Auth not configured" });
    return;
  }
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: "Missing credentials" });
    return;
  }
  if (String(email).toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (!verifyPassword(String(password))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken(ADMIN_EMAIL);
  res.json({ token });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

async function sendCsv(res, filename) {
  const filePath = path.join(dataDir, filename);
  const csv = await readFile(filePath, "utf-8");
  res.type("text/csv").send(csv);
}

async function readCsv(filename) {
  const filePath = path.join(dataDir, filename);
  const csv = await readFile(filePath, "utf-8");
  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors?.length) {
    throw new Error(`Invalid CSV ${filename}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
}

async function writeCsv(filename, rows, fields) {
  const filePath = path.join(dataDir, filename);
  const csv = Papa.unparse(rows, { columns: fields, header: true });
  await writeFile(filePath, `${csv}\n`, "utf-8");
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

  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return { error: "El mes debe tener formato YYYY-MM." };
  }
  const month = Number(mes.slice(5, 7));
  if (month < 1 || month > 12) {
    return { error: "El mes debe estar entre 01 y 12." };
  }
  if (!codigoOficina) {
    return { error: "Falta codigo_oficina." };
  }
  const oficina = oficinas.find((item) => String(item.codigo_oficina).trim() === codigoOficina);
  if (!oficina) {
    return { error: "La oficina no existe en oficinas.csv." };
  }
  if (!["A4", "OFICIO"].includes(tipoHoja)) {
    return { error: "tipo_hoja debe ser A4 u OFICIO." };
  }
  if (!Number.isFinite(resmas) || resmas <= 0) {
    return { error: "resmas debe ser un numero mayor a 0." };
  }
  if (!fechaInput) {
    return { error: "Falta fecha." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInput)) {
    return { error: "La fecha debe tener formato YYYY-MM-DD." };
  }
  if (!fechaInput.startsWith(`${mes}-`)) {
    return { error: "La fecha debe pertenecer al mes informado." };
  }
  if (!["create", "update"].includes(mode)) {
    return { error: "mode debe ser create o update." };
  }

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
    const oficinas = await readCsv("oficinas.csv");
    const validation = validateConsumoPayload(req.body, oficinas);
    if (validation.error) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const { mode, ...entry } = validation.value;
    const filename = consumoFilenameForMes(entry.mes);
    const rows = await readCsv(filename);
    const duplicateIndex = rows.findIndex((row) => {
      return (
        String(row.mes).trim() === entry.mes &&
        String(row.codigo_oficina).trim() === entry.codigo_oficina &&
        String(row.tipo_hoja).trim().toUpperCase() === entry.tipo_hoja
      );
    });

    if (duplicateIndex >= 0 && mode !== "update") {
      res.status(409).json({
        error: "Ya existe una carga para ese mes, oficina y tipo de hoja.",
        code: "DUPLICATE_CONSUMO",
      });
      return;
    }

    if (duplicateIndex >= 0) {
      rows[duplicateIndex] = entry;
    } else {
      rows.push(entry);
    }

    await writeCsv(filename, rows, CONSUMO_HEADERS);
    res.status(duplicateIndex >= 0 ? 200 : 201).json({
      ok: true,
      action: duplicateIndex >= 0 ? "updated" : "created",
      filename,
      entry,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to write consumo CSV", detail: String(error) });
  }
});

app.post("/api/chat", requireAuth, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
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
      const errText = await response.text();
      res.status(500).json({ error: "OpenAI request failed", detail: errText });
      return;
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content?.trim();
    res.json({ answer: answer || "No pude generar una respuesta." });
  } catch (error) {
    res.status(500).json({ error: "Unexpected error", detail: String(error) });
  }
});

app.listen(port, () => {
  console.log(`Chat API running on http://localhost:${port}`);
});
