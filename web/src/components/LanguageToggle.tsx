import { useLocale, useT, LOCALE_ORDER, LOCALE_LABELS } from "../i18n";

export function LanguageToggle() {
  const [locale, setLocale] = useLocale();
  const t = useT();

  const index = LOCALE_ORDER.indexOf(locale);
  const next = LOCALE_ORDER[(index + 1) % LOCALE_ORDER.length];

  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={() => setLocale(next)}
      aria-label={t("lang.switchTo", { language: LOCALE_LABELS[next] })}
    >
      {locale.toUpperCase()}
    </button>
  );
}
