import type {
  CardCondition,
  CardVariant,
  PokemonCard,
} from "../types/Card.js";


/**
 * Service zum Erstellen von eBay-Titeln.
 *
 * Maximale Länge:
 * 80 Zeichen
 *
 * Priorität:
 *
 * 1. Kartenname
 * 2. Kartennummer
 * 3. Setname
 * 4. Variante
 * 5. Sprache
 * 6. Zustand
 */
export class EbayTitleService {

  private readonly maxLength = 80;


  /**
   * Erstellt automatisch einen
   * eBay-kompatiblen Titel.
   */
  generateTitle(
    card: PokemonCard
  ): string {

    /*
     * Japanische Karten erhalten einen
     * suchfreundlichen Titel mit englischem
     * und deutschem Namen.
     *
     * Der Zusatz "Japanisch" wird ausschließlich
     * verwendet, wenn die Karte tatsächlich aus
     * der japanischen Vorauswahl stammt.
     */
    const isJapanese =
      card.language === "ja";

    const englishName =
      card.englishName
        ? this.cleanCardName(
            card.englishName
          )
        : "";

    const germanName =
      card.germanName
        ? this.cleanCardName(
            card.germanName
          )
        : "";

    const originalName =
      this.cleanCardName(
        card.name
      );

    /*
     * Für japanische Karten verwenden wir
     * englischen und deutschen Namen.
     *
     * Sind beide Namen identisch, wird der Name
     * nur einmal verwendet.
     */
    const name =
      isJapanese
        ? this.joinParts([
            englishName,
            germanName &&
            germanName.toLowerCase() !==
              englishName.toLowerCase()
              ? germanName
              : "",
            englishName ||
            germanName
              ? ""
              : originalName
          ])
        : originalName;


    const number =
      card.number.trim();


    let setName =
      this.cleanSetName(
        card.setName
      );


    let variant =
      this.formatVariant(
        card.variant
      );


    let language =
      isJapanese
        ? ""
        : this.formatLanguage(
            card.language
          );


    /*
     * Bei japanischen Karten wird der Sprachhinweis
     * direkt an den Setnamen angehängt.
     *
     * Dadurch entsteht das gewünschte Format:
     *
     * Englischer Name Deutscher Name Nummer Set - Japanisch
     *
     * und der Hinweis kann nicht durch die spätere
     * Sprach-Kürzungsstufe verloren gehen.
     */
    if (
      isJapanese
    ) {

      setName =
        setName
          ? `${setName} - Japanisch`
          : "Japanisch";

    }


    let condition =
      this.formatCondition(
        card.condition
      );


    /*
     * Vollständigen Titel erstellen.
     */
    let title =
      this.joinParts([
        name,
        number,
        setName,
        variant,
        language,
        condition,
      ]);


    /*
     * Falls der Titel bereits
     * kurz genug ist, sind wir fertig.
     */
    if (
      title.length <= this.maxLength
    ) {

      return title;

    }


    /*
     * Priorität 1:
     *
     * Variante kürzen.
     */
    variant =
      this.getShortVariant(
        card.variant
      );


    title =
      this.joinParts([
        name,
        number,
        setName,
        variant,
        language,
        condition,
      ]);


    if (
      title.length <= this.maxLength
    ) {

      return title;

    }


    /*
     * Priorität 2:
     *
     * Zustand abkürzen.
     */
    condition =
      this.getShortCondition(
        card.condition
      );


    title =
      this.joinParts([
        name,
        number,
        setName,
        variant,
        language,
        condition,
      ]);


    if (
      title.length <= this.maxLength
    ) {

      return title;

    }


    /*
     * Priorität 3:
     *
     * Sprache abkürzen.
     */
    language =
      this.getShortLanguage(
        card.language
      );


    title =
      this.joinParts([
        name,
        number,
        setName,
        variant,
        language,
        condition,
      ]);


    if (
      title.length <= this.maxLength
    ) {

      return title;

    }


    /*
     * Priorität 4:
     *
     * Setname kürzen.
     *
     * Kartenname und Kartennummer
     * bleiben erhalten.
     */
    setName =
      this.shortenSetName(
        setName
      );


    title =
      this.joinParts([
        name,
        number,
        setName,
        variant,
        language,
        condition,
      ]);


    if (
      title.length <= this.maxLength
    ) {

      return title;

    }


    /*
     * Priorität 5:
     *
     * Zustand entfernen.
     */
    title =
      this.joinParts([
        name,
        number,
        setName,
        variant,
        language,
      ]);


    if (
      title.length <= this.maxLength
    ) {

      return title;

    }


    /*
     * Priorität 6:
     *
     * Sprache entfernen.
     */
    title =
      this.joinParts([
        name,
        number,
        setName,
        variant,
      ]);


    if (
      title.length <= this.maxLength
    ) {

      return title;

    }


    /*
     * Letzte Sicherheitsstufe:
     *
     * Setname weiter kürzen.
     */
    setName =
      this.truncate(
        setName,
        20
      );


    title =
      this.joinParts([
        name,
        number,
        setName,
        variant,
      ]);


    /*
     * Absoluter Notfall:
     *
     * Kartenname und Nummer
     * bleiben immer erhalten.
     */
    if (
      title.length > this.maxLength
    ) {

      title =
        this.truncate(
          title,
          this.maxLength
        );

    }


    return title;

  }


  /**
   * Entfernt unnötige Begriffe
   * aus dem Kartennamen.
   */
  private cleanCardName(
    name: string
  ): string {

    return name
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  }


  /**
   * Bereinigt den Setnamen.
   *
   * Diese Begriffe bringen
   * im eBay-Titel wenig Mehrwert
   * und werden deshalb entfernt.
   */
  private cleanSetName(
    setName: string
  ): string {

    let cleaned =
      setName
        .replace(
          /Pokémon Trading Card Game/gi,
          ""
        )
        .replace(
          /Pokemon Trading Card Game/gi,
          ""
        )
        .replace(
          /Trading Card Game/gi,
          ""
        )
        .replace(
          /\bTCG\b/gi,
          ""
        )
        .replace(
          /\bExpansion\b/gi,
          ""
        );


    cleaned =
      cleaned
        .replace(
          /\s+/g,
          " "
        )
        .trim();


    return cleaned;

  }


  /**
   * Kürzt lange Setnamen,
   * ohne einfach blind Zeichen
   * abzuschneiden.
   */
  private shortenSetName(
    setName: string
  ): string {

    const words =
      setName
        .split(" ")
        .filter(Boolean);


    /*
     * Wenn der Setname nur aus
     * wenigen Wörtern besteht,
     * behalten wir ihn.
     */
    if (
      words.length <= 3
    ) {

      return setName;

    }


    /*
     * Die ersten drei Wörter
     * sind normalerweise der
     * wichtigste Teil des Setnamens.
     */
    return words
      .slice(0, 3)
      .join(" ");

  }


  /**
   * Formatiert Kartenvarianten
   * für normale Titel.
   */
  private formatVariant(
    variant: CardVariant
  ): string {

    const variants:
      Record<CardVariant, string> = {

      "normal": "",

      "holo": "Holo",

      "reverse-holo":
        "Reverse Holo",

      "pokeball":
        "Pokéball",

      "masterball":
        "Meisterball",

      "ex":
        "EX",

      "gx":
        "GX",

      "v":
        "V",

      "vmax":
        "VMAX",

      "vstar":
        "VSTAR",

      "tag-team":
        "TAG TEAM",

      "break":
        "BREAK",

      "radiant":
        "Radiant",

      "amazing-rare":
        "Amazing Rare",

      "shiny":
        "Shiny",

      "shiny-holo":
        "Shiny Holo",

      "full-art":
        "Full Art",

      "illustration-rare":
        "Illustration Rare",

      "special-illustration-rare":
        "Special Illustration Rare",

      "ultra-rare":
        "Ultra Rare",

      "hyper-rare":
        "Hyper Rare",

      "secret-rare":
        "Secret Rare",

      "rainbow-rare":
        "Rainbow Rare",

      "gold":
        "Gold",

      "promo":
        "Promo",

      "prism-star":
        "Prism Star",

      "ace-spec":
        "ACE SPEC",

      "trainer-gallery":
        "Trainer Gallery",

      "galarian-gallery":
        "Galarian Gallery",

      "classic-collection":
        "Classic Collection",

      "other":
        "",

    };


    return variants[variant] ?? "";

  }


  /**
   * Kürzere Varianten,
   * falls der Titel zu lang wird.
   */
  private getShortVariant(
    variant: CardVariant
  ): string {

    const variants:
      Record<CardVariant, string> = {

      "normal": "",

      "holo":
        "Holo",

      "reverse-holo":
        "Reverse",

      "pokeball":
        "Pokéball",

      "masterball":
        "Meisterball",

      "ex":
        "EX",

      "gx":
        "GX",

      "v":
        "V",

      "vmax":
        "VMAX",

      "vstar":
        "VSTAR",

      "tag-team":
        "TAG",

      "break":
        "BREAK",

      "radiant":
        "Radiant",

      "amazing-rare":
        "AR",

      "shiny":
        "Shiny",

      "shiny-holo":
        "Shiny Holo",

      "full-art":
        "FA",

      "illustration-rare":
        "IR",

      "special-illustration-rare":
        "SIR",

      "ultra-rare":
        "UR",

      "hyper-rare":
        "HR",

      "secret-rare":
        "SR",

      "rainbow-rare":
        "Rainbow",

      "gold":
        "Gold",

      "promo":
        "Promo",

      "prism-star":
        "Prism",

      "ace-spec":
        "ACE SPEC",

      "trainer-gallery":
        "TG",

      "galarian-gallery":
        "GG",

      "classic-collection":
        "Classic",

      "other":
        "",

    };


    return variants[variant] ?? "";

  }


  /**
   * Sprache für den normalen Titel.
   */
  private formatLanguage(
    language: string
  ): string {

    const languages:
      Record<string, string> = {

      "de":
        "Deutsch",

      "en":
        "Englisch",

      "ja":
        "Japanisch",

    };


    return (
      languages[language]
      ?? ""
    );

  }


  /**
   * Kürzere Sprachbezeichnungen.
   */
  private getShortLanguage(
    language: string
  ): string {

    const languages:
      Record<string, string> = {

      "de":
        "DE",

      "en":
        "EN",

      "ja":
        "JP",

    };


    return (
      languages[language]
      ?? ""
    );

  }


  /**
   * Zustand für normalen Titel.
   */
  private formatCondition(
    condition?: CardCondition
  ): string {

    if (!condition) {

      return "";

    }


    const conditions:
      Record<CardCondition, string> = {

      "mint":
        "Mint",

      "near-mint":
        "Near Mint",

      "excellent":
        "Excellent",

      "good":
        "Good",

      "light-played":
        "Light Played",

      "played":
        "Played",

      "poor":
        "Poor",

    };


    return (
      conditions[condition]
      ?? ""
    );

  }


  /**
   * Kürzere Zustandsbezeichnungen.
   */
  private getShortCondition(
    condition?: CardCondition
  ): string {

    if (!condition) {

      return "";

    }


    const conditions:
      Record<CardCondition, string> = {

      "mint":
        "Mint",

      "near-mint":
        "NM",

      "excellent":
        "EXC",

      "good":
        "Good",

      "light-played":
        "LP",

      "played":
        "Played",

      "poor":
        "Poor",

    };


    return (
      conditions[condition]
      ?? ""
    );

  }


  /**
   * Fügt Titelbestandteile zusammen
   * und entfernt leere Werte.
   */
  private joinParts(
    parts: string[]
  ): string {

    return parts
      .filter(
        (part) =>
          part &&
          part.trim()
      )
      .join(" ")
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  }


  /**
   * Schneidet einen Text auf
   * eine maximale Länge.
   */
  private truncate(
    value: string,
    maxLength: number
  ): string {

    if (
      value.length <= maxLength
    ) {

      return value;

    }


    return value
      .slice(
        0,
        maxLength
      )
      .trim();

  }

}