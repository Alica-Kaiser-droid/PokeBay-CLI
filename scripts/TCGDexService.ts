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
  /**
   * Flexible Kartensuche.
   *
   * Es reicht:
   *
   * - nur Name
   * - nur Kartennummer
   * - oder Name + Kartennummer
   */
  async findCards(
    name: string,
    number: string,
    variant: CardVariant = "normal",
    condition: CardCondition = "near-mint",
    quantity = 1
  ): Promise<PokemonCard[]> {

    const cleanName =
      name.trim();

    const cleanNumber =
      number.trim();


    if (
      !cleanName &&
      !cleanNumber
    ) {

      throw new Error(
        "Bitte mindestens einen Kartennamen oder eine Kartennummer eingeben."
      );

    }


    console.log("");
    console.log("========================================");
    console.log("TCGDEX-FLEXIBLE SUCHE");
    console.log("========================================");
    console.log("Name:", cleanName || "(leer)");
    console.log("Nummer:", cleanNumber || "(leer)");
    console.log("Sprache:", this.language);


    let candidates: CardSearchResult[] =
      [];


    /*
     * Wenn ein Name vorhanden ist,
     * zunächst über TCGDex danach suchen.
     */
    if (
      cleanName
    ) {

      candidates =
        await this.searchByName(
          cleanName
        );

    }


    /*
     * Falls nur eine Nummer angegeben wurde,
     * laden wir alle Karten der Sprache und
     * filtern anschließend lokal.
     *
     * Für die ersten 20 Treffer werden später
     * die vollständigen Kartendaten geladen.
     */
    if (
      !cleanName &&
      cleanNumber
    ) {

      const url =
        new URL(
          `${TCGDEX_BASE_URL}/${this.language}/cards`
        );

      const response =
        await fetch(
          url.toString()
        );

      if (
        !response.ok
      ) {

        throw new Error(
          `TCGdex-Suche fehlgeschlagen: ${response.status}`
        );

      }


      candidates =
        await response.json();

    }


    /*
     * Nummer normalisieren.
     *
     * Unterstützt beispielsweise:
     *
     * 223
     * 223/091
     * 001/094
     */
    let normalizedLocalNumber =
      "";

    if (
      cleanNumber
    ) {

      normalizedLocalNumber =
        this.normalizeNumber(
          cleanNumber
            .split("/")
            [0]
        );


      candidates =
        candidates.filter(
          (card) =>
            this.normalizeNumber(
              card.localId
            ) ===
            normalizedLocalNumber
        );

    }


    /*
     * Exakten Namen bevorzugen.
     */
    if (
      cleanName
    ) {

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

    }


    console.log(
      "Treffer:",
      candidates.length
    );


    /*
     * Nicht unbegrenzt viele Detail-Abfragen
     * an TCGDex senden.
     */
    candidates =
      candidates.slice(
        0,
        20
      );


    const cards: PokemonCard[] =
      [];


    for (
      const candidate
      of candidates
    ) {

      try {

        const fullCard =
          await this.getCard(
            candidate.id
          );


        if (
          !fullCard.set?.id
        ) {

          continue;

        }


        let setName =
          fullCard.set.name ||
          "";


        /*
         * Setname nur bei Bedarf
         * zusätzlich abrufen.
         */
        if (
          !setName
        ) {

          try {

            const fullSet =
              await this.getSet(
                fullCard.set.id
              );


            setName =
              fullSet.name;

          } catch (
            _error
          ) {

            setName =
              fullCard.set.id;

          }

        }


        cards.push({

          tcgDexId:
            fullCard.id,

          name:
            fullCard.name,

          number:
            fullCard.localId,

          setId:
            fullCard.set.id,

          setName,

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

        });

      } catch (
        error
      ) {

        console.error(
          "TCGDex-Kandidat konnte nicht geladen werden:",
          candidate.id,
          error
        );

      }

    }


    return cards;

  }


  /**
   * Kompatibilitäts-Methode.
   *
   * Liefert weiterhin den ersten Treffer
   * zurück, falls anderer Code findCard()
   * verwendet.
   */
  async findCard(
    name: string,
    number: string,
    variant: CardVariant = "normal",
    condition: CardCondition = "near-mint",
    quantity = 1
  ): Promise<PokemonCard | null> {

    const cards =
      await this.findCards(
        name,
        number,
        variant,
        condition,
        quantity
      );


    return (
      cards[0] ??
      null
    );

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
