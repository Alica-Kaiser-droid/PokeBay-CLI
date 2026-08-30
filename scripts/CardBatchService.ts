import type {
  CardCondition,
  CardVariant,
} from "../types/Card.js";

import {
  ListingService,
  type ListingResult,
} from "./ListingService.js";


/**
 * Eingabe einer Karte für den Batch.
 */
export interface CardBatchItem {

  name: string;

  number: string;

  variant?: CardVariant;

  condition?: CardCondition;

  quantity?: number;

  photos?: string[];

  price?: number;

}


/**
 * Karte, die nicht gefunden werden konnte.
 */
export interface CardBatchNotFound {

  item: CardBatchItem;

}


/**
 * Fehler bei der Verarbeitung einer Karte.
 */
export interface CardBatchError {

  item: CardBatchItem;

  error: string;

}


/**
 * Ergebnis eines Karten-Batches.
 */
export interface CardBatchResult {

  /**
   * Erfolgreich erstellte Listings.
   */
  found: ListingResult[];

  /**
   * Nicht gefundene Karten.
   */
  notFound: CardBatchNotFound[];

  /**
   * Karten mit technischen Fehlern.
   */
  errors: CardBatchError[];

}


/**
 * Verarbeitet bis zu 50 Karten
 * und erstellt vollständige Listings.
 */
export class CardBatchService {

  private readonly listingService: ListingService;

  private readonly maxBatchSize = 50;


  constructor(
    language = "de"
  ) {

    this.listingService =
      new ListingService(
        language
      );

  }


  /**
   * Verarbeitet maximal 50 Karten.
   */
  async processBatchOfMax50(
    items: CardBatchItem[]
  ): Promise<CardBatchResult> {

    if (
      items.length > this.maxBatchSize
    ) {

      throw new Error(
        `Ein Batch darf maximal ${this.maxBatchSize} Karten enthalten. ` +
        `Übergeben wurden: ${items.length}.`
      );

    }


    const found: ListingResult[] = [];

    const notFound: CardBatchNotFound[] = [];

    const errors: CardBatchError[] = [];


    for (
      const item of items
    ) {

      try {

        const result =
          await this.listingService.createListing(
            item
          );


        if (!result) {

          notFound.push({
            item,
          });

          continue;

        }


        found.push(
          result
        );

      } catch (
        error
      ) {

        errors.push({

          item,

          error:
            error instanceof Error
              ? error.message
              : String(error),

        });

      }

    }


    return {

      found,

      notFound,

      errors,

    };

  }


  /**
   * Alias für die allgemeine Batch-Verarbeitung.
   *
   * Aktuell ebenfalls maximal 50 Karten.
   */
  async processBatch(
    items: CardBatchItem[]
  ): Promise<CardBatchResult> {

    return this.processBatchOfMax50(
      items
    );

  }

}