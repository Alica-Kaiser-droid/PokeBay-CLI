import { PokemonNameService } from "../services/PokemonNameService.js";

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
     * Wenn die Namenssuche keinen Treffer liefert,
     * aber eine Kartennummer vorhanden ist,
     * alle Karten der Sprache laden.
     *
     * Das ist besonders wichtig bei japanischen Karten,
     * wenn der eingegebene Name englisch oder deutsch ist.
     */
    if (
      candidates.length === 0 &&
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
     * Kartennummer normalisieren.
     *
     * Unterstützt beispielsweise:
     *
     * 223
     * 223/091
     * 001/094
     *
     * Bei einer Nummer mit "/Gesamtzahl" wird zusätzlich
     * die offizielle Kartenzahl des Sets berücksichtigt.
     * Dadurch wird beispielsweise 019/165 nicht mit jeder
     * beliebigen Karte Nummer 019 verwechselt.
     */
    let normalizedLocalNumber =
      "";

    let normalizedTotalNumber =
      "";

    const numberParts =
      cleanNumber
        ? cleanNumber.split("/")
        : [];


    if (
      cleanNumber
    ) {

      normalizedLocalNumber =
        this.normalizeNumber(
          numberParts[0]
        );


      if (
        numberParts.length > 1 &&
        numberParts[1]
      ) {

        normalizedTotalNumber =
          this.normalizeNumber(
            numberParts[1]
          );

      }


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


    /*
     * Wenn zusätzlich die Gesamtzahl des Sets angegeben wurde,
     * laden wir die Kandidaten zunächst vollständig und filtern
     * anschließend nach set.cardCount.official.
     *
     * Beispiel:
     * 019/165 -> lokale Nummer 019 und Setgröße 165.
     */
    if (
      normalizedTotalNumber
    ) {

      const candidatesWithMatchingSetTotal:
        CardSearchResult[] =
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


          /*
           * fullCard.set enthält laut API-Typ nur
           * grundlegende Setinformationen.
           *
           * Für die offizielle Gesamtzahl laden wir
           * deshalb die vollständigen Setdaten.
           */
          /*
           * Eine Karte ohne Set kann nicht
           * mit der offiziellen Setgröße
           * verglichen werden.
           */
          if (
            !fullCard.set?.id
          ) {

            continue;

          }


          const fullSet =
            await this.getSet(
              fullCard.set.id
            );

          const officialCount =
            fullSet.cardCount?.official ??
            fullSet.cardCount?.total;


          if (
            this.normalizeNumber(
              String(
                officialCount ??
                ""
              )
            ) ===
            normalizedTotalNumber
          ) {

            candidatesWithMatchingSetTotal.push(
              candidate
            );

          }

        } catch (
          error
        ) {

          console.error(
            "TCGDex-Kandidat konnte für Setgröße nicht geladen werden:",
            candidate.id,
            error
          );

        }

      }


      /*
       * Nur ersetzen, wenn die Setgröße tatsächlich
       * einen oder mehrere passende Treffer liefert.
       */
      if (
        candidatesWithMatchingSetTotal.length > 0
      ) {

        candidates =
          candidatesWithMatchingSetTotal;

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
           * Gesamte offizielle Kartenanzahl des Sets.
           *
           * Beispiel:
           *
           * Karte: 019
           * Set:   165 Karten
           *
           * Ergebnis:
           *
           * 019/165
           */
          let setCardTotal:
            number | undefined;

          /*
           * Vollständige Setdaten laden.
           *
           * Die Setdaten liefern sowohl den
           * vollständigen Setnamen als auch die
           * offizielle Gesamtzahl der Karten.
           */
          try {

            const fullSet =
              await this.getSet(
                fullCard.set.id
              );

            console.log(
              "TCGDex Set-Diagnose:",
              {
                cardId:
                  fullCard.id,

                setId:
                  fullCard.set.id,

                setName:
                  fullSet.name,

                cardCount:
                  fullSet.cardCount,

                rawSet:
                  fullSet,
              }
            );


            if (
              !setName
            ) {

              setName =
                fullSet.name;

            }

            const total =
              fullSet.cardCount?.official ||
              fullSet.cardCount?.total;

            if (
              typeof total === "number" &&
              Number.isFinite(total) &&
              total > 0
            ) {

              setCardTotal =
                total;

            }

          } catch (
            _error
          ) {

            if (
              !setName
            ) {

              setName =
                fullCard.set.id;

            }

          }


          /*
           * Japanische Kartennamen anhand japanischer
           * Schriftzeichen erkennen.
           *
           * Der TCGDexService kann mit "de" erstellt
           * worden sein und trotzdem eine Karte mit
           * japanischem Namen zurückgeben.
           */
          const isJapanese =
            /[\u3040-\u30ff\u3400-\u9fff]/.test(
              fullCard.name
            );


          let englishName:
            string | undefined;

          let germanName:
            string | undefined;


          /*
           * Japanische Pokémon-Namen über die bereits
           * vorhandene zentrale Namensdatenbank auflösen.
           *
           * Dadurch sind wir nicht davon abhängig,
           * dass dieselbe TCGDex Card-ID unter /en und
           * /de existiert.
           */
          if (
            isJapanese
          ) {

            const names =
              PokemonNameService.getNames(
                fullCard.name
              );

            englishName =
              names?.english;

            germanName =
              names?.german;


            console.log(
              "PokemonNameService Diagnose:",
              {
                japaneseName:
                  fullCard.name,

                englishName,

                germanName,
              }
            );

          }


        cards.push({

          tcgDexId:
            fullCard.id,

          name:
            fullCard.name,

            englishName,

            germanName,

          number:
            fullCard.localId,

            setCardTotal,


          setId:
            fullCard.set.id,

          setName,

          rarity:
            fullCard.rarity,

          /*
           * Nur echte Bild-URLs von TCGDex verwenden.
           *
           * Manche Karten, insbesondere ältere japanische
           * Karten, besitzen in der TCGDex-API kein Bild.
           * Für diese Karten bleibt image bewusst undefined,
           * damit keine nicht existierende Asset-URL erzeugt
           * wird.
           */
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
