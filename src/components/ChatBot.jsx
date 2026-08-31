import { useEffect, useMemo, useRef, useState } from "react";
import { buildAuthHeaders, getToken } from "../lib/auth";
import { readChatResponse } from "../lib/chat";
import styles from "./ChatBot.module.css";

const quickQuestions = [
  "¿Cuál es el impacto en agua con los filtros actuales?",
  "¿Qué mes tuvo mayor consumo?",
  "¿Cuál es la oficina con más consumo según los filtros actuales?",
];

export default function ChatBot({ context }) {
  const apiBase = import.meta.env.VITE_API_URL || "";
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hola, soy Fisqui, la IA que te ayuda a ahorrar." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inFlightRequest = useRef(null);

  const promptContext = useMemo(() => context || {}, [context]);

  useEffect(() => () => inFlightRequest.current?.abort(), []);

  const sendQuestion = async (question, { restoreOnFailure = false } = {}) => {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion || inFlightRequest.current) return;
    const controller = new AbortController();
    inFlightRequest.current = controller;
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: normalizedQuestion }]);

    try {
      const token = getToken();
      const authHeaders = buildAuthHeaders(token);
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ question: normalizedQuestion, context: promptContext }),
        signal: controller.signal,
      });
      const answer = await readChatResponse(res);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: answer },
      ]);
    } catch (error) {
      if (restoreOnFailure) setInput((current) => current || normalizedQuestion);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error?.name === "AbortError"
              ? "La consulta fue cancelada."
              : error instanceof Error
                ? error.message
                : "No se pudo consultar a Fisqui.",
        },
      ]);
    } finally {
      if (inFlightRequest.current === controller) {
        inFlightRequest.current = null;
        setLoading(false);
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (inFlightRequest.current) return;
    const question = input;
    setInput("");
    sendQuestion(question, { restoreOnFailure: true });
  };

  const cancelQuestion = () => inFlightRequest.current?.abort();

  return (
    <div className={styles.floating}>
      <button
        type="button"
        className={styles.fab}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
        title={isOpen ? "Cerrar chat" : "Abrir chat"}
      >
        {isOpen ? (
          <span className={styles.fabLabel}>X</span>
        ) : (
          <svg className={styles.fabIcon} viewBox="0 0 24 24" aria-hidden="true">
            <rect x="4" y="6.5" width="16" height="11" rx="4" fill="#ffffff" />
            <rect x="9" y="2.5" width="6" height="4" rx="2" fill="#ffffff" />
            <circle cx="9.5" cy="11.5" r="1.4" fill="#2fb57c" />
            <circle cx="14.5" cy="11.5" r="1.4" fill="#2fb57c" />
            <path d="M8.5 14.5c1 1 2.3 1.5 3.5 1.5s2.5-.5 3.5-1.5" stroke="#2fb57c" strokeWidth="1.4" strokeLinecap="round" fill="none" />
            <path d="M7 18.5h10" stroke="#e9f1ff" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <div className={`${styles.card} ${isOpen ? styles.cardOpen : styles.cardClosed}`}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Fisqui</div>
            <div className={styles.subtitle}>La IA que te ayuda a ahorrar.</div>
          </div>
          <span className={styles.status}>{loading ? "Pensando..." : "Listo"}</span>
        </div>

        <div className={styles.messages}>
          {messages.map((m, idx) => (
            <div
              key={`${m.role}-${idx}`}
              className={m.role === "user" ? styles.userMessage : styles.botMessage}
            >
              {m.content}
            </div>
          ))}
        </div>

        <div className={styles.quickRow}>
          {quickQuestions.map((q) => (
            <button
              key={q}
              type="button"
              className={styles.quickButton}
              onClick={() => sendQuestion(q)}
              disabled={loading}
            >
              {q}
            </button>
          ))}
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            maxLength={1000}
          />
          <button
            className={styles.send}
            type={loading ? "button" : "submit"}
            onClick={loading ? cancelQuestion : undefined}
          >
            {loading ? "Cancelar" : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}
