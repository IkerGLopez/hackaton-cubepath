const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const STREAM_TIMEOUT_MS = 50000;

const parseSseEvents = (rawChunk, onEvent) => {
  const normalized = rawChunk.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");

  for (const block of blocks) {
    if (!block.trim()) {
      continue;
    }

    const lines = block.split("\n");
    const eventLine = lines.find((line) => line.startsWith("event:"));
    const dataLine = lines.find((line) => line.startsWith("data:"));

    if (!eventLine || !dataLine) {
      continue;
    }

    const event = eventLine.replace("event:", "").trim();
    const dataText = dataLine.replace("data:", "").trim();

    try {
      const data = JSON.parse(dataText);
      onEvent(event, data);
    } catch {
      onEvent(event, { raw: dataText });
    }
  }
};

export const streamChat = async ({
  message,
  signal,
  onToken,
  onDone,
  onError,
  onMeta,
  onDiagnostics,
}) => {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), STREAM_TIMEOUT_MS);
  const abortByCaller = () => timeoutController.abort();
  signal?.addEventListener("abort", abortByCaller);

  let doneEventReceived = false;

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      let details = `Request failed with status ${response.status}`;

      try {
        const errorPayload = await response.json();
        details = errorPayload?.details || errorPayload?.error || details;
      } catch {
        // Keep default message when body is not JSON.
      }

      throw new Error(details);
    }

    if (!response.body) {
      throw new Error("Streaming is not supported by this browser");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      const lastDoubleBreak = buffer.lastIndexOf("\n\n");
      if (lastDoubleBreak === -1) {
        continue;
      }

      const completed = buffer.slice(0, lastDoubleBreak + 2);
      buffer = buffer.slice(lastDoubleBreak + 2);

      parseSseEvents(completed, (event, data) => {
        if (event === "token") {
          onToken?.(data?.token || "");
        }

        if (event === "meta") {
          onMeta?.(data || null);
        }

        if (event === "error") {
          onError?.(data?.details || data?.error || "Unknown stream error");
        }

        if (event === "diagnostics") {
          onDiagnostics?.(data || null);
        }

        if (event === "done") {
          doneEventReceived = true;
          onDone?.();
        }
      });
    }

    if (buffer.trim()) {
      parseSseEvents(buffer, (event, data) => {
        if (event === "meta") {
          onMeta?.(data || null);
        }

        if (event === "diagnostics") {
          onDiagnostics?.(data || null);
        }

        if (event === "done") {
          doneEventReceived = true;
          onDone?.();
        }

        if (event === "error") {
          onError?.(data?.details || data?.error || "Unknown stream error");
        }
      });
    }

    if (!doneEventReceived) {
      onDone?.();
    }
  } catch (error) {
    if (timeoutController.signal.aborted && !signal?.aborted) {
      throw new Error("The request timed out. Please try again.");
    }

    if (signal?.aborted) {
      throw new Error("Request cancelled");
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("No internet connection. Check your network and retry.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortByCaller);
  }
};
