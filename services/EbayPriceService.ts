import axios from "axios";


export interface EbayPriceSearchRequest {
  name: string;

  englishName?: string;
  germanName?: string;

  language?: string;

  number?: string;
  setName?: string;
  variant?: string;
  condition?: string;
}


interface EbayTokenResponse {
  access_token: string;
  expires_in: number;
}


interface EbayItemSummary {
  title?: string;

  price?: {
    value?: string;
    currency?: string;
  };

  currentBidPrice?: {
    value?: string;
    currency?: string;
  };

  buyingOptions?: string[];

  condition?: string;
}


interface EbaySearchResponse {
  itemSummaries?: EbayItemSummary[];
}


class EbayPriceService {

  private static accessToken:
    string | null = null;

  private static tokenExpiresAt = 0;


  private static getEnvironment() {

    return (
      process.env.EBAY_ENVIRONMENT ??
      "PRODUCTION"
    ).toUpperCase();

  }


  private static getCredentials() {

    const environment =
      this.getEnvironment();


    const isSandbox =
      environment === "SANDBOX";


    const appId =
      isSandbox
        ? process.env.EBAY_APP_ID_SANDBOX
        : process.env.EBAY_APP_ID_PRODUCTION;


    const certId =
      isSandbox
        ? process.env.EBAY_CERT_ID_SANDBOX
        : process.env.EBAY_CERT_ID_PRODUCTION;


    if (
      !appId ||
      !certId
    ) {

      throw new Error(
        `eBay App-ID oder Cert-ID für ${environment} fehlt.`
      );

    }


    return {
      appId: appId.trim(),
      certId: certId.trim(),
      isSandbox
    };

  }


  private static getBaseUrl() {

    const {
      isSandbox
    } =
      this.getCredentials();


    return isSandbox
      ? "https://api.sandbox.ebay.com"
      : "https://api.ebay.com";

  }


  private static async getAccessToken() {

    /*
     * Vorhandenen Token verwenden,
     * solange er noch mindestens
     * eine Minute gültig ist.
     */
    if (
      this.accessToken &&
      Date.now() <
        this.tokenExpiresAt - 60000
    ) {

      return this.accessToken;

    }


    const {
      appId,
      certId,
      isSandbox
    } =
      this.getCredentials();


    const baseUrl =
      this.getBaseUrl();


    const maskCredential =
      (value: string) => {

        if (value.length <= 8) {
          return "[MASKED]";
        }

        return (
          value.slice(0, 4) +
          "..." +
          value.slice(-4)
        );

      };


    console.log("");
    console.log("========================================");
    console.log("EBAY OAUTH DIAGNOSE");
    console.log("========================================");
    console.log(
      "Environment:",
      isSandbox
        ? "SANDBOX"
        : "PRODUCTION"
    );
    console.log(
      "Base URL:",
      baseUrl
    );
    console.log(
      "App ID vorhanden:",
      Boolean(appId)
    );
    console.log(
      "App ID Länge:",
      appId.length
    );
    console.log(
      "App ID maskiert:",
      maskCredential(appId)
    );
    console.log(
      "Cert ID vorhanden:",
      Boolean(certId)
    );
    console.log(
      "Cert ID Länge:",
      certId.length
    );
    console.log(
      "Cert ID maskiert:",
      maskCredential(certId)
    );


    const credentials =
      Buffer.from(
        `${appId}:${certId}`
      ).toString(
        "base64"
      );


    console.log(
      "eBay Application Token wird abgerufen..."
    );


    let response;

    try {

      response =
        await axios.post<EbayTokenResponse>(
          `${baseUrl}/identity/v1/oauth2/token`,
          new URLSearchParams({
            grant_type:
              "client_credentials",

            scope:
              "https://api.ebay.com/oauth/api_scope"
          }).toString(),
          {
            headers: {
              "Authorization":
                `Basic ${credentials}`,

              "Content-Type":
                "application/x-www-form-urlencoded"
            }
          }
        );

    } catch (error) {

      if (
        axios.isAxiosError(error)
      ) {

        console.error(
          "========================================"
        );

        console.error(
          "EBAY OAUTH FEHLER"
        );

        console.error(
          "========================================"
        );

        console.error(
          "Environment:",
          this.getEnvironment()
        );

        console.error(
          "Base URL:",
          baseUrl
        );

        console.error(
          "HTTP Status:",
          error.response?.status ?? "unbekannt"
        );

        console.error(
          "eBay Fehler:",
          error.response?.data ?? error.message
        );

      } else {

        console.error(
          "Unbekannter eBay OAuth Fehler:",
          error
        );

      }

      throw error;

    }


    this.accessToken =
      response.data.access_token;


    this.tokenExpiresAt =
      Date.now() +
      (
        response.data.expires_in *
        1000
      );


    return this.accessToken;

  }


  private static buildQuery(
    card: EbayPriceSearchRequest
  ) {

    const parts: string[] = [];


      /*
       * Japanische Kartennamen funktionieren für die
       * eBay-Suche häufig schlechter als international
       * verwendete Namen.
       *
       * Deshalb bevorzugen wir bei japanischen Karten:
       *
       * Englisch -> Deutsch -> Originalname
       */
      const searchName =
        card.language === "ja"
          ? (
              card.englishName ||
              card.germanName ||
              card.name
            )
          : card.name;


      if (searchName) {
        parts.push(searchName);
      }


    if (card.number) {
      parts.push(card.number);
    }


    if (card.setName) {
      parts.push(card.setName);
    }


    if (
      card.variant &&
      card.variant !== "normal"
    ) {

      const variantMap:
        Record<string, string> = {

        "reverse-holo":
          "Reverse Holo",

        "reverse_holo":
          "Reverse Holo",

        "pokeball":
          "Pokeball",

        "masterball":
          "Masterball",

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
          "Secret Rare"
      };


      parts.push(
        variantMap[
          card.variant
        ] ??
        card.variant
      );

    }


    return parts
      .filter(Boolean)
      .join(" ");

  }


  static async getActivePrice(
    card: EbayPriceSearchRequest
  ): Promise<number | null> {

    console.log("");
    console.log("========================================");
    console.log("EBAY ACTIVE PRICE START");
    console.log("========================================");
    console.log(
      "Environment:",
      this.getEnvironment()
    );
    console.log(
      "App ID vorhanden:",
      Boolean(
        this.getEnvironment() === "SANDBOX"
          ? process.env.EBAY_APP_ID_SANDBOX
          : process.env.EBAY_APP_ID_PRODUCTION
      )
    );
    console.log(
      "Cert ID vorhanden:",
      Boolean(
        this.getEnvironment() === "SANDBOX"
          ? process.env.EBAY_CERT_ID_SANDBOX
          : process.env.EBAY_CERT_ID_PRODUCTION
      )
    );

    const token =
      await this.getAccessToken();


    console.log(
      "OAuth Token erhalten:",
      Boolean(token)
    );


    const baseUrl =
      this.getBaseUrl();


    console.log(
      "eBay Base URL:",
      baseUrl
    );


    const query =
      this.buildQuery(card);


    console.log(
      "eBay Preisvergleich:",
      query
    );


    let response;

    try {

      response =
        await axios.get<EbaySearchResponse>(
          `${baseUrl}/buy/browse/v1/item_summary/search`,
          {
            params: {

              q:
                query,

              limit:
                20

            },

            headers: {

              "Authorization":
                `Bearer ${token}`,

              "X-EBAY-C-MARKETPLACE-ID":
                "EBAY_DE",

              "Accept":
                "application/json"

            },

            timeout:
              20000
          }
        );

    } catch (error) {

      if (
        axios.isAxiosError(error)
      ) {

        console.error(
          "eBay Active Price API Fehler"
        );

        console.error(
          "HTTP Status:",
          error.response?.status ??
          "kein HTTP Status"
        );

        console.error(
          "eBay Antwort:",
          JSON.stringify(
            error.response?.data ??
            {
              message:
                error.message
            },
            null,
            2
          )
        );

        console.error(
          "eBay URL:",
          `${baseUrl}/buy/browse/v1/item_summary/search`
        );

        console.error(
          "Marketplace:",
          "EBAY_DE"
        );

      } else {

        console.error(
          "Unbekannter eBay Active Price Fehler:",
          error
        );

      }

      throw error;

    }


    const items =
      response.data.itemSummaries ??
      [];


    console.log(
      "eBay API erfolgreich."
    );

    console.log(
      "Gefundene Items:",
      items.length
    );


    /*
     * Nur brauchbare Preise übernehmen.
     *
     * Bei Auktionen verwenden wir,
     * falls vorhanden, das aktuelle Gebot.
     */
    const prices =
      items
        .map(
          (item) => {

            const value =
              item.price?.value ??
              item.currentBidPrice?.value;


            const price =
              Number(value);


            return Number.isFinite(price) &&
              price > 0
                ? price
                : null;

          }
        )
        .filter(
          (
            value
          ): value is number =>
            value !== null
        );


    if (
      prices.length === 0
    ) {

      console.log(
        "Keine eBay-Preise gefunden."
      );

      return null;

    }


    /*
     * Ausreißer entfernen:
     * Wir sortieren und verwenden
     * die mittleren 80 %.
     */
    prices.sort(
      (a, b) =>
        a - b
    );


    const trim =
      prices.length >= 5
        ? Math.floor(
            prices.length * 0.1
          )
        : 0;


    const filtered =
      prices.slice(
        trim,
        prices.length - trim
      );


    const average =
      filtered.reduce(
        (sum, price) =>
          sum + price,
        0
      ) /
      filtered.length;


    const result =
      Number(
        average.toFixed(2)
      );


    console.log(
      `eBay aktive Angebote: ${prices.length}`
    );

    console.log(
      `eBay Durchschnitt: ${result} €`
    );


    return result;

  }

  /*
   * Preis tatsächlich verkaufter Artikel.
   *
   * Die öffentliche eBay Browse API liefert
   * keine abgeschlossenen/verkauften Listings
   * als normale Suchergebnisse.
   *
   * Deshalb wird hier zunächst bewusst null
   * zurückgegeben, bis eine geeignete
   * eBay-Datenquelle angebunden ist.
   */
  static async getSoldPrice(
    card: EbayPriceSearchRequest
  ): Promise<number | null> {

    const query =
      this.buildQuery(card);

    console.log(
      "eBay verkaufte Artikel Suche:",
      query
    );

    /*
     * Verkaufsdatenquelle wird hier
     * später angebunden.
     *
     * Die restliche Preislogik ist
     * bereits vorbereitet.
     */

    return null;

  }

  static async getSoldPrices(
    card: EbayPriceSearchRequest
  ): Promise<number[]> {

    const price =
      await this.getSoldPrice(card);

    return price !== null
      ? [price]
      : [];

  }


}


export default EbayPriceService;
