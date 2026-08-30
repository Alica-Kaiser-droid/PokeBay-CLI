import type { CardVariant } from "./Card.js";


export interface CardVariantInfo {
  id: CardVariant;
  label: string;
}


export const CARD_VARIANTS: CardVariantInfo[] = [

  {
    id: "normal",
    label: "Normal",
  },

  {
    id: "holo",
    label: "Holo",
  },

  {
    id: "reverse-holo",
    label: "Reverse Holo",
  },

  {
    id: "pokeball",
    label: "Pokéball",
  },

  {
    id: "masterball",
    label: "Meisterball",
  },

  {
    id: "ex",
    label: "EX",
  },

  {
    id: "gx",
    label: "GX",
  },

  {
    id: "v",
    label: "V",
  },

  {
    id: "vmax",
    label: "VMAX",
  },

  {
    id: "vstar",
    label: "VSTAR",
  },

  {
    id: "tag-team",
    label: "TAG TEAM",
  },

  {
    id: "break",
    label: "BREAK",
  },

  {
    id: "radiant",
    label: "Radiant",
  },

  {
    id: "amazing-rare",
    label: "Amazing Rare",
  },

  {
    id: "shiny",
    label: "Shiny",
  },

  {
    id: "shiny-holo",
    label: "Shiny Holo",
  },

  {
    id: "full-art",
    label: "Full Art",
  },

  {
    id: "illustration-rare",
    label: "Illustration Rare",
  },

  {
    id: "special-illustration-rare",
    label: "Special Illustration Rare",
  },

  {
    id: "ultra-rare",
    label: "Ultra Rare",
  },

  {
    id: "hyper-rare",
    label: "Hyper Rare",
  },

  {
    id: "secret-rare",
    label: "Secret Rare",
  },

  {
    id: "rainbow-rare",
    label: "Rainbow Rare",
  },

  {
    id: "gold",
    label: "Gold",
  },

  {
    id: "promo",
    label: "Promo",
  },

  {
    id: "prism-star",
    label: "Prism Star",
  },

  {
    id: "ace-spec",
    label: "ACE SPEC",
  },

  {
    id: "trainer-gallery",
    label: "Trainer Gallery",
  },

  {
    id: "galarian-gallery",
    label: "Galarian Gallery",
  },

  {
    id: "classic-collection",
    label: "Classic Collection",
  },

  {
    id: "other",
    label: "Sonstige",
  },

];