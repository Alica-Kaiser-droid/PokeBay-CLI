export type CardVariant =
  | "normal"
  | "holo"
  | "reverse_holo"
  | "promo"
  | "other";

export interface CardSearchResult {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

export interface PokemonCard {
  tcgDexId: string;

  name: string;
  number: string;

  setId: string;
  setName: string;

  rarity?: string;

  image?: string;

  language: string;

  variant: CardVariant;
}
