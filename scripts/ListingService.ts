import type {
  CardCondition,
  CardVariant,
  PokemonCard,
} from "../types/Card.js";

import {
  TcgDexService,
} from "./TCGDexService.js";

import {
  EbayTitleService,
} from "./EbayTitleService.js";


/**
 * Eingabedaten für eine Karte.
 *
 * Diese Daten werden später
 * über unsere Web-/Handy-Oberfläche
 * eingegeben.
 */
export interface CreateListingInput {

  /**
   * Kartenname.
   *
   * Beispiel:
   * Charizard
   */
  name: string;


  /**
   * Kartennummer.
   *
   * Beispiele:
   * 34
   * 034
   * 034/132
   * TG12
   */
  number: string;


  /**
   * Kartenvariante.
   */
  variant?: CardVariant;


  /**
   * Zustand.
   */
  condition?: CardCondition;


  /**
   * Menge.
   */
  quantity?: number;


  /**
   * Eigene Fotos.
   *
   * Später kommen hier die
   * hochgeladenen Bildpfade hinein.
   */
  photos?: string[];


  /**
   * Verkaufspreis.
   *
   * Optional.
   */
  price?: number;

}


/**
 * Vollständiges Ergebnis für ein Listing.
 */
export interface ListingResult {

  /**
   * Gefundene Karte.
   */
  card: PokemonCard;


  /**
   * Automatisch erzeugter eBay-Titel.
   */
  ebayTitle: string;

}


/**
 * Zentraler Service für die
 * Erstellung von Karten-Listings.
 */
export class ListingService {

  private readonly tcgDexService: TcgDexService;

  private readonly ebayTitleService: EbayTitleService;


  constructor(
    language = "de"
  ) {

    this.tcgDexService =
      new TcgDexService(
        language
      );


    this.ebayTitleService =
      new EbayTitleService();

  }


  /**
   * Erstellt ein vollständiges Listing
   * aus den vom Benutzer eingegebenen Daten.
   */
  async createListing(
    input: CreateListingInput
  ): Promise<ListingResult | null> {

    const variant =
      input.variant ??
      "normal";


    const condition =
      input.condition ??
      "near-mint";


    const quantity =
      input.quantity ??
      1;


    /*
     * Karte bei TCGdex suchen.
     */
    const card =
      await this.tcgDexService.findCard(
        input.name,
        input.number,
        variant,
        condition,
        quantity
      );


    /*
     * Keine passende Karte gefunden.
     */
    console.log("LISTING CARD:", { name: card?.name, englishName: card?.englishName, germanName: card?.germanName, number: card?.number, setName: card?.setName, language: card?.language });
    if (!card) {

      return null;

    }


    /*
     * Eigene Verkaufsdaten ergänzen.
     */
    card.photos =
      input.photos;


    card.price =
      input.price;


    /*
     * eBay-Titel erzeugen.
     */
    const ebayTitle =
      this.ebayTitleService.generateTitle(
        card
      );


    /*
     * Titel auch direkt an der Karte speichern.
     */
    card.title =
      ebayTitle;


    return {

      card,

      ebayTitle,

    };

  }

}