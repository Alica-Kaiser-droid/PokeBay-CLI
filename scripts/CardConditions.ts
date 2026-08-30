import type { CardCondition } from "./Card.js";


export interface CardConditionInfo {
  id: CardCondition;
  label: string;
}


export const CARD_CONDITIONS: CardConditionInfo[] = [

  {
    id: "mint",
    label: "Mint",
  },

  {
    id: "near-mint",
    label: "Near Mint",
  },

  {
    id: "excellent",
    label: "Excellent",
  },

  {
    id: "good",
    label: "Good",
  },

  {
    id: "light-played",
    label: "Light Played",
  },

  {
    id: "played",
    label: "Played",
  },

  {
    id: "poor",
    label: "Poor",
  },

];