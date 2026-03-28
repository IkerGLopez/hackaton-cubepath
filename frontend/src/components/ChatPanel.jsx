import { useEffect, useMemo, useState } from "react";
import { useResolvedFontCards } from "../hooks/useResolvedFontCards";
import FontRecommendationCard from "./FontRecommendationCard";

const ensureStylesheetLoaded = (href) => {
  if (!href || typeof document === "undefined") {
    return;
  }

  const alreadyLoaded = Array.from(document.querySelectorAll("link[rel='stylesheet']"))
    .some((link) => link.href === href);

  if (alreadyLoaded) {
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-font-stylesheet", "true");
  document.head.appendChild(link);
};

function ChatPanel({
  message,
  onMessageChange,
  onSubmit,
  onRetry,
  onStop,
  isLoading,
  responseText,
  parsedRecommendation,
  error,
  hasSuccess,
  canRetry,
}) {
  const [previewText, setPreviewText] = useState("");

  const sourceRecommendations = useMemo(
    () => parsedRecommendation?.recommendations || [],
    [parsedRecommendation],
  );
  const { cards } = useResolvedFontCards(sourceRecommendations);

  const recommendationSignature = useMemo(
    () => sourceRecommendations.map((entry) => entry.fontFamily).join("|"),
    [sourceRecommendations],
  );

  useEffect(() => {
    const firstSample = sourceRecommendations[0]?.sampleText || "";
    setPreviewText(firstSample);
  }, [recommendationSignature, sourceRecommendations]);

  useEffect(() => {
    cards.forEach((card) => {
      ensureStylesheetLoaded(card.stylesheetUrl);
    });
  }, [cards]);

  const hasCardRecommendations = sourceRecommendations.length > 0 && cards.length > 0;

  return (
    <aside className="rounded-3xl border border-stone-900/10 bg-stone-900 p-5 text-stone-100 shadow-[0_24px_50px_-30px_rgba(25,15,10,0.85)] sm:p-6">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-amber-300">CHATBOT</p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs text-stone-300">Describe your design context</span>
          <textarea
            className="min-h-32 w-full rounded-2xl border border-stone-700 bg-stone-950/80 p-4 text-sm text-stone-100 outline-none ring-amber-300/50 transition focus:ring"
            placeholder="Example: I need a high-contrast pairing for a legal services landing page with strong trust signals"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Streaming..." : "Generate recommendation"}
          </button>

          <button
            type="button"
            className="rounded-xl border border-stone-600 px-4 py-2 text-sm text-stone-200 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onRetry}
            disabled={isLoading || !canRetry}
          >
            Retry
          </button>

          <button
            type="button"
            className="rounded-xl border border-stone-600 px-4 py-2 text-sm text-stone-200 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onStop}
            disabled={!isLoading}
          >
            Stop
          </button>
        </div>
      </form>

      <div className="mt-5 rounded-2xl border border-stone-700 bg-stone-950/70 p-4">
        {isLoading && <p className="text-xs tracking-[0.16em] text-amber-200">LOADING</p>}
        {hasSuccess && <p className="text-xs tracking-[0.16em] text-emerald-300">SUCCESS</p>}
        {error && (
          <p className="rounded-lg border border-red-300/30 bg-red-400/10 px-3 py-2 text-xs text-red-100">
            ERROR: {error}
          </p>
        )}

        {parsedRecommendation ? (
          <div className="mt-3 space-y-3 text-sm text-stone-100">
            <div className="rounded-xl border border-stone-700 bg-stone-900/80 p-3">
              <label htmlFor="font-preview-input" className="text-[11px] tracking-[0.16em] text-amber-200">
                PREVIEW TEXT
              </label>
              <input
                id="font-preview-input"
                type="text"
                value={previewText}
                onChange={(event) => setPreviewText(event.target.value)}
                placeholder="Write your own preview sentence"
                className="mt-2 w-full rounded-lg border border-stone-600 bg-stone-950/80 px-3 py-2 text-sm text-stone-100 outline-none ring-amber-300/40 focus:ring"
              />
            </div>

            {hasCardRecommendations && (
              <div className="grid gap-3">
                {cards.map((card) => (
                  <FontRecommendationCard
                    key={`${card.fontFamily}-${card.role}`}
                    card={card}
                    previewText={previewText}
                  />
                ))}
              </div>
            )}

            {!hasCardRecommendations && parsedRecommendation.googleFontsLinks.length > 0 && (
              <div className="rounded-xl border border-stone-700 bg-stone-900/80 p-3">
                <p className="text-[11px] tracking-[0.16em] text-amber-200">GOOGLE FONTS LINKS</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {parsedRecommendation.googleFontsLinks.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-amber-300/40 px-2 py-1 text-xs text-amber-200 hover:bg-amber-200/10"
                    >
                      Open link
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <pre className="mt-3 max-h-104 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-stone-100">
            {responseText || "Your streamed recommendation will appear here."}
          </pre>
        )}
      </div>
    </aside>
  );
}

export default ChatPanel;
