// scripts/TCGDexService.ts

import type {
  CardSearchResult,
  CardVariant,
  CardCondition,
  PokemonCard,
} from "../types/Card.js";


const TCGDEX_BASE_URL = "https://api.tcgdex.net/v2";


/**
 * Kurzform einer Karte aus der TCGdex-Suche.
 */
interface TcgDexCardBrief {
  id: string;
  localId: string;
  name: string;
  image?: string;
}


/**
 * Vollständige Karte von TCGdex.
 */
interface TcgDexCard {
  id: string;
  localId: string;
  name: string;

  image?: string;

  rarity?: string;

  set?: {
    id: string;
    name: string;
  };
}


/**
 * Optionen für die Kartensuche.
 *
 * Diese Daten kommen später aus deinem Tool:
 *
 * - Variante
 * - Zustand
 * - Menge
 * - Fotos
 * - Preis
 */
export interface FindCardOptions {
  variant?: CardVariant;
  condition?: CardCondition;
  quantity?: number;
  photos?: string[];
  price?: number;
  title?: string;
}


export class TcgDexService {

  private readonly language: string;


  constructor(language = "de") {
    this.language = language;
  }


  /**
   * Sucht Karten anhand ihres Namens.
   *
   * Beispiel:
   *
   * searchByName("Kyogre")
   */
  async searchByName(
    name: string
  ): Promise<CardSearchResult[]> {

    const cleanName =
      name.trim();


    if (!cleanName) {
      return [];
    }


    const url = new URL(
      `${TCGDEX_BASE_URL}/${this.language}/cards`
    );


    url.searchParams.set(
      "name",
      cleanName
    );


    const response =
      await fetch(
        url.toString()
      );


    if (!response.ok) {

      throw new Error(
        `TCGdex-Suche fehlgeschlagen: ` +
        `${response.status} ${response.statusText}`
      );

    }


    const cards: TcgDexCardBrief[] =
      await response.json();


    return cards.map((card) => ({

      id:
        card.id,

      localId:
        card.localId,

      name:
        card.name,

      image:
        card.image,

    }));
  }


  /**
   * Lädt die vollständigen Daten
   * einer einzelnen Karte.
   *
   * Beispiel:
   *
   * getCard("me01-034")
   */
  async getCard(
    cardId: string
  ): Promise<TcgDexCard> {

    const cleanCardId =
      cardId.trim();


    if (!cleanCardId) {

      throw new Error(
        "Keine TCGdex-Karten-ID angegeben."
      );

    }


    const response =
      await fetch(
        `${TCGDEX_BASE_URL}/${this.language}/cards/${encodeURIComponent(cleanCardId)}`
      );


    if (!response.ok) {

      throw new Error(
        `Karte nicht gefunden: ${cleanCardId}`
      );

    }


    return await response.json();
  }


  /**
   * Sucht eine Karte anhand von:
   *
   * - Name
   * - Kartennummer
   *
   * Zusätzliche Verkaufsdaten können
   * über options übergeben werden.
   *
   * Beispiel:
   *
   * findCard(
   *   "Kyogre",
   *   "34",
   *   {
   *     variant: "holo",
   *     condition: "near-mint",
   *     quantity: 1
   *   }
   * )
   */
  async findCard(
    name: string,
    number: string,
    options: FindCardOptions = {}
  ): Promise<PokemonCard | null> {

    const cleanName =
      name.trim();


    const cleanNumber =
      number.trim();


    if (!cleanName || !cleanNumber) {

      return null;

    }


    /*
     * Standardwerte.
     */

    const variant: CardVariant =
      options.variant ?? "normal";


    const quantity =
      this.normalizeQuantity(
        options.quantity
      );


    /*
     * Schritt 1:
     * Alle Karten mit diesem Namen suchen.
     */

    const cards =
      await this.searchByName(
        cleanName
      );


    if (cards.length === 0) {
      return null;
    }


    /*
     * Schritt 2:
     * Kartennummer normalisieren.
     */

    const normalizedNumber =
      this.normalizeNumber(
        cleanNumber
      );


    /*
     * Schritt 3:
     * Exakte Übereinstimmung suchen.
     *
     * Beispiele:
     *
     * Eingabe: 34
     * TCGdex: 034
     *
     * => Treffer
     */

    const exactMatch =
      cards.find((card) => {

        return (
          this.normalizeNumber(
            card.localId
          ) === normalizedNumber
        );

      });


    /*
     * Schritt 4:
     * Falls keine exakte Übereinstimmung
     * vorhanden ist, versuchen wir
     * eine alternative Suche.
     *
     * Das hilft beispielsweise bei:
     *
     * TG23
     * GG12
     * SV107
     * etc.
     */

    const partialMatch =
      cards.find((card) => {

        const normalizedLocalId =
          this.normalizeNumber(
            card.localId
          );


        return (

          normalizedLocalId ===
            normalizedNumber ||

          normalizedLocalId.startsWith(
            normalizedNumber
          ) ||

          normalizedNumber.startsWith(
            normalizedLocalId
          )

        );

      });


    const matchedCard =
      exactMatch ?? partialMatch;


    if (!matchedCard) {
      return null;
    }


    /*
     * Schritt 5:
     * Vollständige Daten laden.
     */

    const fullCard =
      await this.getCard(
        matchedCard.id
      );


    /*
     * Schritt 6:
     * Ergebnis passend zu PokemonCard bauen.
     */

    const result: PokemonCard = {

      /*
       * Daten von TCGdex
       */

      tcgDexId:
        fullCard.id,


      name:
        fullCard.name,


      number:
        fullCard.localId,


      setId:
        fullCard.set?.id ?? "",


      setName:
        fullCard.set?.name ?? "",


      rarity:
        fullCard.rarity,


      image:
        fullCard.image,


      language:
        this.language,


      /*
       * Verkaufsdaten aus unserem Tool
       */

      variant,


      condition:
        options.condition,


      quantity,


      photos:
        options.photos,


      price:
        options.price,


      title:
        options.title,

    };


    return result;
  }


  /**
   * Vereinheitlicht Kartennummern.
   *
   * Beispiele:
   *
   * "034"      -> "34"
   * "034/132"  -> "34"
   * "34"       -> "34"
   * "TG034"    -> "tg034"
   * "TG034/TG30" -> "tg034"
   * "GG12"     -> "gg12"
   * "SV107"    -> "sv107"
   */
  private normalizeNumber(
    value: string
  ): string {

    let normalized =
      value
        .trim()
        .toLowerCase();


    /*
     * Alles nach "/" entfernen.
     *
     * Beispiele:
     *
     * 034/132
     * ->
     * 034
     *
     * TG23/TG30
     * ->
     * TG23
     */

    normalized =
      normalized.split("/")[0];


    /*
     * Leerzeichen entfernen.
     */

    normalized =
      normalized.replace(
        /\s+/g,
        ""
      );


    /*
     * Führende Nullen entfernen,
     * wenn die Nummer nur aus Ziffern besteht.
     *
     * 034 -> 34
     * 008 -> 8
     */

    if (/^\d+$/.test(normalized)) {

      return String(
        Number(normalized)
      );

    }


    /*
     * Bei IDs mit Buchstaben
     * bleiben die Buchstaben erhalten.
     *
     * TG034 -> tg034
     * GG012 -> gg012
     */

    return normalized;
  }


  /**
   * Stellt sicher, dass quantity
   * mindestens 1 ist.
   */
  private normalizeQuantity(
    quantity?: number
  ): number {

    if (
      typeof quantity !== "number" ||
      !Number.isFinite(quantity)
    ) {

      return 1;

    }


    const normalized =
      Math.floor(quantity);


    if (normalized < 1) {
      return 1;
    }


    return normalized;
  }
}