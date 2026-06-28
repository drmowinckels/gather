// Shared shapes for catalog modules. A catalog value is either a plain string
// or a plural group; `{name}` placeholders are filled at call time.
export type Plural = { one: string; other: string };
export type CatalogPart = Record<string, string | Plural>;

// Per-language metadata, declared in each locale file so the registry can
// discover everything about a language from the file alone.
export interface LocaleMeta {
  // The language's name in its own language (endonym), e.g. "Norsk".
  label: string;
  // Position in the switcher; lower comes first. English stays first at 0.
  order?: number;
}
