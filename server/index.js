import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { readFile } from "fs/promises";
import path from "path";

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
