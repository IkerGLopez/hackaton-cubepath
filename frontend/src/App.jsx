import { useMemo, useState } from "react";
import ChatPanel from "./components/ChatPanel";
import FeatureList from "./components/FeatureList";
import LandingHero from "./components/LandingHero";
import { useChatStream } from "./hooks/useChatStream";
import { parseAiRecommendation } from "./utils/parseAiRecommendation";

function App() {
  const [message, setMessage] = useState("");
  const {
    responseText,
    isLoading,
    error,
    lastMessage,
    submitMessage,
    retryLastMessage,
    stopStreaming,
  } =
    useChatStream();

  const hasSuccess = responseText.length > 0 && !isLoading && !error;
  const canRetry = lastMessage.trim().length > 0;
  const parsedRecommendation = useMemo(() => parseAiRecommendation(responseText), [responseText]);

  const handleUsePrompt = (prompt) => {
    setMessage(prompt);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    await submitMessage(trimmed);
  };

  const handleRetry = async () => {
    await retryLastMessage();
  };

  return (
    <main className="relative overflow-hidden pb-16 pt-10 sm:pb-20 sm:pt-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_20%,rgba(251,191,36,0.28),transparent_35%),radial-gradient(ellipse_at_85%_10%,rgba(249,115,22,0.2),transparent_35%),radial-gradient(ellipse_at_80%_80%,rgba(20,184,166,0.16),transparent_30%)]" />

      <section className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <div className="space-y-5">
            <LandingHero onUsePrompt={handleUsePrompt} />
            <FeatureList />
          </div>

          <ChatPanel
            message={message}
            onMessageChange={setMessage}
            onSubmit={handleSubmit}
            onRetry={handleRetry}
            onStop={stopStreaming}
            isLoading={isLoading}
            responseText={responseText}
            parsedRecommendation={parsedRecommendation}
            error={error}
            hasSuccess={hasSuccess}
            canRetry={canRetry}
          />
        </div>
      </section>
    </main>
  );
}

export default App;
