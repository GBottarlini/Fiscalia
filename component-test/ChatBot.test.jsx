import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ChatBot from "../src/components/ChatBot.jsx";

function abortableRequest() {
  let requestSignal;
  const fetchMock = vi.fn((_url, { signal }) => {
    requestSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  });
  return { fetchMock, getSignal: () => requestSignal };
}

function submitQuestion(question) {
  const input = screen.getByPlaceholderText("Escribe tu pregunta...");
  fireEvent.change(input, { target: { value: question } });
  fireEvent.submit(input.closest("form"));
  return input;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage?.clear();
});

describe("ChatBot request lifecycle", () => {
  test("deduplicates immediate submissions, cancels the request, and restores its text", async () => {
    const { fetchMock, getSignal } = abortableRequest();
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatBot context={{ totalResmas: 10 }} />);

    const input = submitQuestion("¿Cuál es el total?");
    fireEvent.submit(input.closest("form"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(getSignal().aborted).toBe(true));
    await waitFor(() => expect(input.value).toBe("¿Cuál es el total?"));
    expect(screen.getByText("La consulta fue cancelada.")).toBeTruthy();
  });

  test("restores failed text and displays the stable non-2xx message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ code: "CHAT_RATE_LIMITED", error: "internal" }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    render(<ChatBot context={{}} />);

    const input = submitQuestion("¿Qué mes tuvo mayor consumo?");

    expect(
      await screen.findByText(
        "Fisqui está temporalmente ocupado. Intenta nuevamente en unos instantes."
      )
    ).toBeTruthy();
    expect(input.value).toBe("¿Qué mes tuvo mayor consumo?");
  });

  test("aborts the active request when unmounted", async () => {
    const { fetchMock, getSignal } = abortableRequest();
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<ChatBot context={{}} />);
    submitQuestion("¿Cuál es el total?");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    unmount();

    expect(getSignal().aborted).toBe(true);
  });
});
