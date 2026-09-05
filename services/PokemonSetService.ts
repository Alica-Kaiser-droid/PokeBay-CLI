import sets from "../data/pokemon-sets.json";

export interface PokemonSetNames {
  japanese: string;
  english?: string;
  german?: string;
}

export class PokemonSetService {
  static getNames(setId: string): PokemonSetNames | undefined {
    return (sets as Record<string, PokemonSetNames>)[setId];
  }

  static getGermanName(setId: string): string | undefined {
    return this.getNames(setId)?.german;
  }

  static getEnglishName(setId: string): string | undefined {
    return this.getNames(setId)?.english;
  }
}
