export type CardVariant =
  | "normal"
  | "holo"
  | "reverse-holo"
  | "promo"
  | "other"
  | "pokeball"
  | "masterball"
  | "ex"
  | "gx"
  | "v"
  | "vmax"
  | "vstar"
  | "tag-team"
  | "break"
  | "radiant"
  | "amazing-rare"
  | "shiny"
  | "shiny-holo"
  | "full-art"
  | "illustration-rare"
  | "special-illustration-rare"
  | "ultra-rare"
  | "hyper-rare"
  | "secret-rare"
  | "rainbow-rare"
  | "gold"
  | "prism-star"
  | "ace-spec"
  | "trainer-gallery"
  | "galarian-gallery"
  | "classic-collection";

export type CardCondition =
  | "mint"
  | "near-mint"
  | "excellent"
  | "good"
  | "light-played"
  | "played"
  | "poor";

export interface CardSearchResult {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

export interface PokemonCard {
  tcgDexId: string;

  name: string;

  englishName?: string;
  germanName?: string;

  number: string;


    /*
     * Gesamte offizielle Kartenanzahl des Sets.
     *
     * Beispiel:
     *
     * number = "019"
     * setCardTotal = 165
     *
     * Daraus kann für Suchanfragen
     * "019/165" erzeugt werden.
     */
    setCardTotal?: number;
  setId: string;
  setName: string;
  englishSetName?: string;

  rarity?: string;

  image?: string;

  language: string;

  variant: CardVariant;

  condition: CardCondition;

  quantity: number;

  photos?: string[];

  price?: number;

  title?: string;
}
