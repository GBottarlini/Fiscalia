const CHAT_ERROR_MESSAGES = {
  CHAT_INVALID_QUESTION: "Escribe una pregunta válida.",
  CHAT_QUESTION_TOO_LONG: "La pregunta es demasiado extensa.",
  CHAT_NOT_CONFIGURED: "Fisqui no está configurado en este momento.",
  CHAT_TIMEOUT: "Fisqui tardó demasiado en responder. Intenta nuevamente.",
  CHAT_RATE_LIMITED: "Fisqui está temporalmente ocupado. Intenta nuevamente en unos instantes.",
  CHAT_PROVIDER_FAILURE: "No se pudo consultar a Fisqui. Intenta nuevamente.",
  CHAT_INVALID_RESPONSE: "Fisqui no pudo generar una respuesta válida.",
};

export class ChatRequestError extends Error {
  constructor(message, { code = "CHAT_REQUEST_FAILED", status = 0 } = {}) {
    super(message);
    this.name = "ChatRequestError";
    this.code = code;
    this.status = status;
  }
}

export async function readChatResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ChatRequestError("Fisqui devolvió una respuesta no válida.", {
      code: "CHAT_INVALID_RESPONSE",
      status: response.status,
    });
  }

  if (!response.ok) {
    const code = typeof data?.code === "string" ? data.code : "CHAT_REQUEST_FAILED";
    const fallback =
      response.status === 401
        ? "Tu sesión venció. Vuelve a iniciar sesión."
        : "No se pudo consultar a Fisqui. Intenta nuevamente.";
    throw new ChatRequestError(CHAT_ERROR_MESSAGES[code] || fallback, {
      code,
      status: response.status,
    });
  }

  const answer = typeof data?.answer === "string" ? data.answer.trim() : "";
  if (!answer) {
    throw new ChatRequestError(CHAT_ERROR_MESSAGES.CHAT_INVALID_RESPONSE, {
      code: "CHAT_INVALID_RESPONSE",
      status: response.status,
    });
  }
  return answer;
}
