import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
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
