import axios from "axios";


interface CardmarketSearchRequest {
  name: string;
  number?: string;
  setName?: string;
  variant?: string;
  condition?: string;
}


class CardmarketPriceService {

  static async getPrice(
    card: CardmarketSearchRequest
  ): Promise<number | null> {

    try {

      const queryParts = [
        card.name,
        card.number,
        card.setName
      ].filter(Boolean);


      const query =
        queryParts.join(" ");


      console.log(
        "Cardmarket Preissuche:",
        query
      );


      /*
       * Platzhalter für die Cardmarket-Suche.
       *
       * Der Service versucht zunächst,
       * vorhandene Datenquellen zu verwenden.
       */

      return null;

    } catch (error) {

      console.error(
        "Cardmarket Preisfehler:",
        error
      );

      return null;

    }

  }

}


export default CardmarketPriceService;
