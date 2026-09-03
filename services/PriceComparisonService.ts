import CardmarketPriceService
  from "./CardmarketPriceService";

import EbayPriceService
  from "./EbayPriceService";


export interface PriceComparisonRequest {
  name: string;

  englishName?: string;
  germanName?: string;

  language?: string;

  number?: string;
  setName?: string;
  variant?: string;
  condition?: string;
}


export interface PriceComparisonResult {
  ebayActive: number | null;
  ebaySold: number | null;
  cardmarket: number | null;
  recommendation: number | null;
}


class PriceComparisonService {

  static async compare(
    card: PriceComparisonRequest
  ): Promise<PriceComparisonResult> {


    /*
     * Quellen parallel abfragen.
     *
     * Falls eine Quelle ausfällt,
     * soll der gesamte Vergleich
     * nicht abbrechen.
     */
    const [
      ebayActiveResult,
      ebaySoldResult,
      cardmarketResult
    ] =
      await Promise.allSettled([

        EbayPriceService.getActivePrice(
          card
        ),

        EbayPriceService.getSoldPrices(
          card
        ),

        CardmarketPriceService.getPrice(
          card
        )

      ]);


    const ebayActive =
      ebayActiveResult.status ===
      "fulfilled"
        ? ebayActiveResult.value
        : null;


    const cardmarket =
      cardmarketResult.status ===
      "fulfilled"
        ? cardmarketResult.value
        : null;


    if (
      ebayActiveResult.status ===
      "rejected"
    ) {

      console.error(
        "eBay Preisvergleich fehlgeschlagen:",
        ebayActiveResult.reason
      );

    }


    if (
      cardmarketResult.status ===
      "rejected"
    ) {

      console.error(
        "Cardmarket Preisvergleich fehlgeschlagen:",
        cardmarketResult.reason
      );

    }


    const soldPrices =
      ebaySoldResult.status ===
      "fulfilled"
        ? ebaySoldResult.value
        : [];

    const ebaySold =
      soldPrices.length > 0
        ? Number(
            (
              soldPrices.reduce(
                (sum, price) =>
                  sum + price,
                0
              ) /
              soldPrices.length
            ).toFixed(2)
          )
        : null;


    if (
      ebaySoldResult.status ===
      "rejected"
    ) {

      console.error(
        "eBay Sold Preisvergleich fehlgeschlagen:",
        ebaySoldResult.reason
      );

    }


    const values =
      [
        ebayActive,
        ebaySold
      ].filter(
        (
          value
        ): value is number =>

          typeof value === "number" &&
          Number.isFinite(value) &&
          value > 0

      );


    const recommendation =
      values.length > 0

        ? Number(
            (
              values.reduce(
                (
                  sum,
                  value
                ) =>
                  sum + value,
                0
              ) /
              values.length
            ).toFixed(2)
          )

        : null;


    return {

      ebayActive,
      ebaySold,
      cardmarket,
      recommendation

    };

  }

}


export default PriceComparisonService;
