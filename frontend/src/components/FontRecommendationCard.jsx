import { useEffect, useMemo, useState } from "react";

const parseVariant = (rawVariant) => {
  const normalized = String(rawVariant || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "regular") {
    return {
      key: "400",
      label: "400",
      fontWeight: 400,
      fontStyle: "normal",
    };
  }

  if (normalized === "italic") {
    return {
      key: "400italic",
      label: "400 italic",
      fontWeight: 400,
      fontStyle: "italic",
    };
  }

  const weightItalicMatch = normalized.match(/^([1-9]00)(italic)?$/);
  if (weightItalicMatch) {
    const [, weightText, italicToken] = weightItalicMatch;

    return {
      key: italicToken ? `${weightText}italic` : weightText,
      label: italicToken ? `${weightText} italic` : weightText,
      fontWeight: Number.parseInt(weightText, 10),
      fontStyle: italicToken ? "italic" : "normal",
    };
  }

  return null;
};

const buildVariantOptions = (variants) => {
  const parsed = (Array.isArray(variants) ? variants : [])
    .map((variant) => parseVariant(variant))
    .filter(Boolean);

  const unique = [];
  const seenKeys = new Set();

  for (const option of parsed) {
    if (seenKeys.has(option.key)) {
      continue;
    }

    seenKeys.add(option.key);
    unique.push(option);
  }

  if (!unique.length) {
    return [
      {
        key: "400",
        label: "400",
        fontWeight: 400,
        fontStyle: "normal",
      },
    ];
  }

  return unique;
};

function FontRecommendationCard({ card, previewText }) {
  const renderedPreview = previewText.trim() || card.sampleText;

  const variantOptions = useMemo(() => buildVariantOptions(card.variants), [card.variants]);
  const variantSignature = useMemo(
    () => variantOptions.map((option) => option.key).join("|"),
    [variantOptions],
  );

  const [selectedVariantKey, setSelectedVariantKey] = useState(variantOptions[0].key);

  useEffect(() => {
    setSelectedVariantKey(variantOptions[0].key);
  }, [card.fontFamily, variantSignature, variantOptions]);

  const selectedVariant = useMemo(
    () => variantOptions.find((option) => option.key === selectedVariantKey) || variantOptions[0],
    [selectedVariantKey, variantOptions],
  );

  return (
    <article className="rounded-2xl border border-stone-700 bg-stone-900/80 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg text-stone-100">{card.fontFamily}</h3>
        <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-200">
          {card.role}
        </span>
        <span className="rounded-full border border-stone-600 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-stone-300">
          {card.provider}
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-stone-300">{card.shortRationale}</p>

      <div className="mt-3 rounded-xl border border-stone-700 bg-stone-950/80 p-3">
        <p
          className="text-xl leading-relaxed text-stone-50"
          style={{
            fontFamily: `"${card.fontFamily}", "Space Grotesk", sans-serif`,
            fontWeight: selectedVariant.fontWeight,
            fontStyle: selectedVariant.fontStyle,
          }}
        >
          {renderedPreview}
        </p>
      </div>

      {variantOptions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {variantOptions.slice(0, 8).map((option) => (
            <button
              key={`${card.fontFamily}-${option.key}`}
              type="button"
              onClick={() => setSelectedVariantKey(option.key)}
              className={`rounded-md border px-1.5 py-0.5 text-[10px] transition ${
                selectedVariant.key === option.key
                  ? "border-amber-300/70 bg-amber-300/15 text-amber-100"
                  : "border-stone-600 text-stone-300 hover:bg-stone-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4">
        <a
          href={card.downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-lg border border-amber-300/50 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-200/10"
        >
          Download font
        </a>
      </div>
    </article>
  );
}

export default FontRecommendationCard;
