import "dotenv/config";

import express from "express";
import multer from "multer";
import EbayXmlBuilderService from "./EbayXmlBuilderService";
import PriceComparisonService
  from "./PriceComparisonService";

import EbayService from "./EbayService";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  TcgDexService,
} from "../scripts/TCGDexService.js";


const __filename =
  fileURLToPath(
    import.meta.url
  );

const __dirname =
  path.dirname(
    __filename
  );


const app =
  express();


const upload =
  multer({
    storage:
      multer.memoryStorage()
  });

const PORT =
  Number(
    process.env.PORT
  ) || 3000;


const tcgDexService =
  new TcgDexService(
    "de"
  );


app.use(
  express.json()
);



/**
 * Privater Zugriffsschutz für PokeBay
 *
 * Erwartet Environment Variables:
 * POKEBAY_AUTH_USER
 * POKEBAY_AUTH_PASSWORD
 */
const authUser =
  process.env.POKEBAY_AUTH_USER
    ?.trim();

const authPassword =
  process.env.POKEBAY_AUTH_PASSWORD
    ?.trim();


if (
  !authUser ||
  !authPassword
) {

  throw new Error(
    "POKEBAY_AUTH_USER oder POKEBAY_AUTH_PASSWORD fehlt."
  );

}


app.use(
  (
    req,
    res,
    next
  ) => {

    const authorization =
      req.headers.authorization;


    if (
      !authorization ||
      !authorization.startsWith(
        "Basic "
      )
    ) {

      res.setHeader(
        "WWW-Authenticate",
        'Basic realm="PokeBay Private"'
      );

      res.status(401).send(
        "Authentifizierung erforderlich."
      );

      return;

    }


    try {

      const encoded =
        authorization.slice(
          "Basic ".length
        );

      const decoded =
        Buffer.from(
          encoded,
          "base64"
        ).toString(
          "utf8"
        );

      const separatorIndex =
        decoded.indexOf(
          ":"
        );


      if (
        separatorIndex === -1
      ) {

        throw new Error(
          "Ungültige Zugangsdaten."
        );

      }


      const username =
        decoded.slice(
          0,
          separatorIndex
        );

      const password =
        decoded.slice(
          separatorIndex + 1
        );


      if (
        username.trim() !== authUser ||
        password.trim() !== authPassword
      ) {

        res.setHeader(
          "WWW-Authenticate",
          'Basic realm="PokeBay Private"'
        );

        res.status(401).send(
          "Ungültige Zugangsdaten."
        );

        return;

      }


      next();

    } catch {

      res.setHeader(
        "WWW-Authenticate",
        'Basic realm="PokeBay Private"'
      );

      res.status(401).send(
        "Ungültige Zugangsdaten."
      );

    }

  }
);


app.use(
  express.static(
    path.join(
      __dirname,
      "..",
      "public"
    )
  )
);


/**
 * Kartensuche
 *
 * Erwartet:
 * {
 *   "name": "Myrapla",
 *   "number": "001/094"
 * }
 */
app.post(
  "/api/cards/search",
  async (
    req,
    res
  ) => {

    try {

      const {
        name,
        number,
        language = "de",
      } =
        req.body;


      const cleanName =
        typeof name === "string"
          ? name.trim()
          : "";


      const cleanNumber =
        typeof number === "string"
          ? number.trim()
          : "";


      if (
        !cleanName &&
        !cleanNumber
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Bitte mindestens einen Kartennamen oder eine Kartennummer eingeben.",
        });

      }


      if (
        ![
          "de",
          "en",
          "ja",
        ].includes(language)
      ) {

        return res.status(400).json({
          success: false,
          error:
            "Ungültige Sprache. Erlaubt sind Deutsch, Englisch oder Japanisch.",
        });

      }


      console.log("");
      console.log("========================================");
      console.log("KARTENSUCHE");
      console.log("========================================");
      console.log("Name:", name);
      console.log("Nummer:", number);
      console.log("Sprache:", language);
      console.log("Nummer JSON:", JSON.stringify(number));
      console.log("Nummer Typ:", typeof number);


      const searchService =
        new TcgDexService(
          language
        );


      const cards =
        await searchService.findCards(
          cleanName,
          cleanNumber
        );


      if (
        cards.length === 0
      ) {

        return res.status(404).json({
          success: false,
          error:
            "Keine passenden Karten gefunden.",
        });

      }


      console.log(
        `✓ ${cards.length} Karte(n) gefunden.`
      );


      res.json({
        success: true,
        cards,
      });

    } catch (
      error
    ) {

      console.error(
        "Fehler bei der Kartensuche:",
        error
      );


      res.status(500).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unbekannter Serverfehler.",
      });

    }

  }
);



app.post(
  "/api/listings/create",
  upload.any(),
  async (req, res) => {

    try {

      const cardsJson =
        req.body.cards;

      if (
        !cardsJson
      ) {

        return res.status(400).json({
          success: false,
          error: "Keine Karten erhalten."
        });

      }


      let cards;

      try {

        cards =
          JSON.parse(
            cardsJson
          );

      } catch {

        return res.status(400).json({
          success: false,
          error:
            "Kartendaten konnten nicht verarbeitet werden."
        });

      }


      if (
        !Array.isArray(cards) ||
        cards.length === 0
      ) {

        return res.status(400).json({
          success: false,
          error: "Keine Karten erhalten."
        });

      }


      const files =
        Array.isArray(req.files)
          ? req.files
          : [];


      const imagesDir =
        path.join(
          __dirname,
          "..",
          "images"
        );


      await import(
        "node:fs/promises"
      ).then(
        async (fs) => {

          await fs.mkdir(
            imagesDir,
            {
              recursive: true
            }
          );

        }
      );


      for (
        let index = 0;
        index < cards.length;
        index++
      ) {

        const card =
          cards[index];


        const cardFiles =
          files.filter(
            (file: any) =>
              file.fieldname ===
              `images_${index}`
          );


        const imageNames: string[] =
          [];


        for (
          const file of cardFiles
        ) {

          const safeName =
            String(
              file.originalname ||
              "image"
            )
              .replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
              );


          const imageName =
            `${Date.now()}-${index}-${imageNames.length}-${safeName}`;


          const imagePath =
            path.join(
              imagesDir,
              imageName
            );


          await import(
            "node:fs/promises"
          ).then(
            (fs) =>
              fs.writeFile(
                imagePath,
                file.buffer
              )
          );


          imageNames.push(
            imageName
          );

        }


        card.images =
          imageNames;


        console.log(
          "\n========================================"
        );

        console.log(
          "STARTE EBAY LISTING"
        );

        console.log(
          "Karte:",
          card.name
        );

        console.log(
          "Bilder:",
          imageNames
        );

        console.log(
          "========================================\n"
        );

      }


      const results = [];


      for (
        const card of cards
      ) {

        try {

          const xml =
            await EbayXmlBuilderService
              .buildAddItemXML(
                card
              );


          await EbayService.addItem(
            xml
          );


          results.push({
            name:
              card.name,

            success:
              true
          });


        } catch (
          error
        ) {

          console.error(
            "\n========================================"
          );

          console.error(
            "❌ EBAY LISTING FEHLER"
          );

          console.error(
            "Karte:",
            card.name
          );

          console.error(
            error
          );

          console.error(
            "========================================\n"
          );


          results.push({
            name:
              card.name,

            success:
              false,

            error:
              error instanceof Error
                ? error.message
                : String(error)
          });

        }

      }


      res.json({
        success:
          true,

        results
      });


    } catch (
      error
    ) {

      console.error(
        "Listing-Erstellung fehlgeschlagen:",
        error
      );


      res.status(500).json({

        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(error)

      });

    }

  }
);


/*
 * Preisvergleich für eine Karte.
 *
 * eBay- und Cardmarket-Anbindung
 * wird hier später ergänzt.
 */
app.post(
  "/api/cards/pricing",
  async (req, res) => {

    try {

      const {
        name,
        number,
        setName,
        variant,
        condition
      } = req.body;

      console.log(
        "Preisvergleich:",
        name,
        number,
        setName,
        variant,
        condition
      );

      /*
       * Vorläufige Struktur.
       * Die echten Preisquellen werden
       * im nächsten Schritt angeschlossen.
       */
      const ebayActive = [];
      const ebaySold = [];
      const cardmarket = [];

      res.json({
        success: true,

        ebay: {
          active: ebayActive,
          sold: ebaySold
        },

        cardmarket,

        recommendation: null
      });

    } catch (error) {

      res.status(500).json({
        success: false,
        error: String(error)
      });

    }

  }
);




app.post(
  "/api/prices/compare",
  async (req, res) => {

    try {

      const card =
        req.body;

      if (
        !card ||
        !card.name
      ) {

        return res.status(400).json({
          success: false,
          error: "Kartendaten fehlen."
        });

      }


      const result =
        await PriceComparisonService.compare(
          card
        );


      res.json({
        success: true,
        result
      });

    } catch (error) {

      console.error(
        "Preisvergleich fehlgeschlagen:",
        error
      );

      res.status(500).json({
        success: false,
        error: String(error)
      });

    }

  }
);


app.get(
  "/",
  (
    _req,
    res
  ) => {

    res.sendFile(
      path.join(
        __dirname,
        "..",
        "public",
        "index.html"
      )
    );

  }
);


app.listen(
  PORT,
  () => {

    console.log("");
    console.log("========================================");
    console.log("POKEBAY SERVER GESTARTET");
    console.log("========================================");
    console.log(
      `Server läuft auf: http://localhost:${PORT}`
    );
    console.log("");

  }
);
