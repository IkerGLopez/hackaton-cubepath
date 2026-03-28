const SAMPLE_PROMPTS = [
  "Premium serif + clean sans for a legal-tech brand homepage",
  "Friendly type system for an ed-tech product used by teens",
  "Bold modern pairing for a high-conversion SaaS landing page",
];

function LandingHero({ onUsePrompt }) {
  return (
    <section className="rounded-3xl border border-amber-900/20 bg-white/70 p-5 shadow-[0_14px_50px_-30px_rgba(30,20,10,0.45)] backdrop-blur sm:p-7">
      <p
        className="text-[11px] font-semibold tracking-[0.2em] text-amber-700"
        style={{ fontFamily: '"Fraunces", Georgia, serif' }}
      >
        fONTIT TYPE STUDIO
      </p>

      <h1 className="mt-4 text-4xl leading-[0.95] text-stone-900 sm:text-5xl lg:text-6xl">
        Turn brand intent into typography that feels unmistakably yours
      </h1>

      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-stone-700 sm:text-base">
        Describe your audience, tone, and product context. The assistant streams curated font pairings in
        real time, with rationale and practical implementation guidance.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {SAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onUsePrompt(prompt)}
            className="rounded-2xl border border-stone-200 bg-white px-3 py-3 text-left text-xs leading-relaxed text-stone-700 transition hover:border-amber-300 hover:bg-amber-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}

export default LandingHero;
