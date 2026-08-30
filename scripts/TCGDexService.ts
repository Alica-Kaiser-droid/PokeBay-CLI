import type {
  CardCondition,
  CardSearchResult,
  CardVariant,
  PokemonCard,
} from "../types/Card.js";


const TCGDEX_BASE_URL =
  "https://api.tcgdex.net/v2";


interface TcgDexCardBrief {
  id: string;
  localId: string;
  name: string;
  image?: string;
}


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


interface TcgDexSet {
  id: string;
  name: string;

  cardCount?: {
    total?: number;
    official?: number;
  };
}


export class TcgDexService {

  private readonly language: string;


  constructor(
    language = "de"
  ) {

    this.language = language;

  }


  async searchByName(
    name: string
  ): Promise<CardSearchResult[]> {

    const url =
      new URL(
        `${TCGDEX_BASE_URL}/${this.language}/cards`
      );

    url.searchParams.set(
      "name",
      name.trim()
    );

    const response =
      await fetch(
        url.toString()
      );

    if (!response.ok) {

      throw new Error(
        `TCGdex-Suche fehlgeschlagen: ${response.status}`
      );

    }

    const cards: TcgDexCardBrief[] =
      await response.json();

    return cards.map(
      (card) => ({

        id: card.id,

        localId: card.localId,

        name: card.name,

        image: card.image,

      })
    );

  }


  async getCard(
    cardId: string
  ): Promise<TcgDexCard> {

    const response =
      await fetch(
        `${TCGDEX_BASE_URL}/${this.language}/cards/${encodeURIComponent(cardId)}`
      );

    if (!response.ok) {

      throw new Error(
        `Karte nicht gefunden: ${cardId}`
      );

    }

    return await response.json();

  }


  async getSet(
    setId: string
  ): Promise<TcgDexSet> {

    const response =
      await fetch(
        `${TCGDEX_BASE_URL}/${this.language}/sets/${encodeURIComponent(setId)}`
      );

    if (!response.ok) {

      throw new Error(
        `Set nicht gefunden: ${setId}`
      );

    }

    return await response.json();

  }


  /**
   * Beispiel:
   *
   * name   = "Myrapla"
   * number = "001/094"
   */
  async findCard(
    name: string,
    number: string,
    variant: CardVariant = "normal",
    condition: CardCondition = "near-mint",
    quantity = 1
  ): Promise<PokemonCard | null> {

    const cleanName =
      name.trim();

    const cleanNumber =
      number.trim();


    if (!cleanName) {

      throw new Error(
        "Bitte einen Kartennamen eingeben."
      );

    }


    if (!cleanNumber) {

      throw new Error(
        "Bitte eine Kartennummer eingeben."
      );

    }


    /*
     * 001/094 zerlegen.
     */
    const parts =
      cleanNumber
        .split("/")
        .map(
          (part) =>
            part.trim()
        );


    if (
      parts.length !== 2 ||
      !parts[0] ||
      !parts[1]
    ) {

      throw new Error(
        'Bitte die Nummer im Format "001/094" eingeben.'
      );

    }


    const localNumber =
      parts[0];

    const setNumber =
      parts[1];


    const normalizedLocalNumber =
      this.normalizeNumber(
        localNumber
      );

    const normalizedSetNumber =
      this.normalizeNumber(
        setNumber
      );


    console.log("");
    console.log("========================================");
    console.log("TCGDEX-SUCHE");
    console.log("========================================");
    console.log("Name:", cleanName);
    console.log("Nummer:", cleanNumber);


    /*
     * Zuerst nach Name suchen.
     */
    const cards =
      await this.searchByName(
        cleanName
      );


    /*
     * Dann exakt nach der
     * Kartennummer filtern.
     */
    let candidates =
      cards.filter(
        (card) =>
          this.normalizeNumber(
            card.localId
          ) === normalizedLocalNumber
      );


    /*
     * Exakten Namen bevorzugen.
     *
     * Dadurch wird Myrapla gegenüber
     * "Erikas Myrapla" bevorzugt.
     */
    const exactNameCandidates =
      candidates.filter(
        (card) =>
          this.normalizeText(
            card.name
          ) ===
          this.normalizeText(
            cleanName
          )
      );


    if (
      exactNameCandidates.length > 0
    ) {

      candidates =
        exactNameCandidates;

    }


    console.log(
      "Kandidaten:",
      candidates.map(
        (card) => card.id
      )
    );


    /*
     * Jeden Kandidaten prüfen.
     */
    for (
      const candidate
      of candidates
    ) {

      const fullCard =
        await this.getCard(
          candidate.id
        );


      if (
        !fullCard.set?.id
      ) {

        continue;

      }


      const fullSet =
        await this.getSet(
          fullCard.set.id
        );


      const possibleSetNumbers = [

        fullSet.cardCount?.official,

        fullSet.cardCount?.total,

      ].filter(
        (
          value
        ): value is number =>
          value !== undefined
      );


      console.log(
        "Prüfe:",
        fullCard.name,
        fullCard.localId,
        fullSet.name,
        possibleSetNumbers
      );


      const matchingSetNumber =
        possibleSetNumbers.find(
          (value) =>
            this.normalizeNumber(
              String(value)
            ) === normalizedSetNumber
        );


      if (
        matchingSetNumber === undefined
      ) {

        continue;

      }


      console.log(
        "✓ RICHTIGE KARTE:",
        fullCard.name,
        `${fullCard.localId}/${matchingSetNumber}`
      );


      return {

        tcgDexId:
          fullCard.id,

        name:
          fullCard.name,

        number:
          `${fullCard.localId}/${String(matchingSetNumber).padStart(3, "0")}`,

        setId:
          fullCard.set.id,

        setName:
          fullCard.set.name ??
          fullSet.name,

        rarity:
          fullCard.rarity,

        image:
          fullCard.image,

        language:
          this.language,

        variant,

        condition,

        quantity:
          Number.isFinite(quantity) &&
          quantity > 0
            ? Math.floor(quantity)
            : 1,

      };

    }


    return null;

  }


  private normalizeNumber(
    value: string
  ): string {

    const normalized =
      value
        .trim()
        .toLowerCase()
        .replace(
          /\s+/g,
          ""
        );


    if (
      /^\d+$/.test(
        normalized
      )
    ) {

      return String(
        Number(normalized)
      );

    }


    const match =
      normalized.match(
        /^([a-z]+)(\d+)$/
      );


    if (match) {

      return (
        match[1] +
        String(
          Number(match[2])
        )
      );

    }


    return normalized;

  }


  private normalizeText(
    value: string
  ): string {

    return value
      .trim()
      .toLowerCase()
      .replace(
        /\s+/g,
        " "
      );

  }

}
