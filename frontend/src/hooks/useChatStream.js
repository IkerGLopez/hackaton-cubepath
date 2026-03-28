import { useCallback, useRef, useState } from "react";
import { streamChat } from "../services/chatService";

export const useChatStream = () => {
  const abortControllerRef = useRef(null);

  const [responseText, setResponseText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastMessage, setLastMessage] = useState("");
  const [contextMeta, setContextMeta] = useState(null);
  const [streamDiagnostics, setStreamDiagnostics] = useState(null);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
  }, []);

  const submitMessage = useCallback(async (message) => {
    abortControllerRef.current?.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setResponseText("");
    setError("");
    setContextMeta(null);
    setStreamDiagnostics(null);
    setIsLoading(true);
    setLastMessage(message);

    try {
      await streamChat({
        message,
        signal: abortController.signal,
        onToken: (token) => {
          setResponseText((prev) => prev + token);
        },
        onDone: () => {
          setIsLoading(false);
        },
        onError: (details) => {
          setError(details || "The assistant failed while streaming.");
          setIsLoading(false);
        },
        onMeta: (meta) => {
          setContextMeta(meta);
        },
        onDiagnostics: (diagnostics) => {
          setStreamDiagnostics(diagnostics);
        },
      });
    } catch (streamError) {
      if (abortController.signal.aborted) {
        setError("");
        setIsLoading(false);
        return;
      }

      if (streamError?.message === "Request cancelled") {
        setError("");
        setIsLoading(false);
        return;
      }

      setError(streamError?.message || "Unexpected chat error");
      setIsLoading(false);
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, []);

  const retryLastMessage = useCallback(async () => {
    if (!lastMessage.trim()) {
      return;
    }

    await submitMessage(lastMessage);
  }, [lastMessage, submitMessage]);

  return {
    responseText,
    isLoading,
    error,
    lastMessage,
    contextMeta,
    streamDiagnostics,
    submitMessage,
    retryLastMessage,
    stopStreaming,
  };
};
