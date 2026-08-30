import fs from "fs";
import path from "path";

import EbayXmlBuilderService from "./services/EbayXmlBuilderService";
import EbayService from "#services/EbayService";


async function main() {

    console.log("");
    console.log("========================================");
    console.log("POKEBAY – ECHTES EBAY TEST-LISTING");
    console.log("========================================");
    console.log("");


    /*
     * items.json laden
     */
    const itemsPath =
        path.join(
            process.cwd(),
            "items.json"
        );


    if (
        !fs.existsSync(itemsPath)
    ) {

        throw new Error(
            `items.json wurde nicht gefunden: ${itemsPath}`
        );

    }


    const itemsRaw =
        fs.readFileSync(
            itemsPath,
            "utf8"
        );


    const cards =
        JSON.parse(
            itemsRaw
        );


    if (
        !Array.isArray(cards)
    ) {

        throw new Error(
            "items.json enthält kein Array."
        );

    }


    if (
        cards.length === 0
    ) {

        throw new Error(
            "items.json enthält keine Karten."
        );

    }


    /*
     * WICHTIG:
     *
     * Für den ersten echten Test
     * verwenden wir ABSICHTLICH
     * nur die erste Karte.
     */
    const card =
        cards[0];


    console.log(
        "Testkarte:"
    );

    console.log(
        "Name:",
        card.name
    );

    console.log(
        "Nummer:",
        card.number
    );

    console.log(
        "Set:",
        card.setName ??
        card.set ??
        "-"
    );

    console.log(
        "Preis:",
        card.price ??
        card.startPrice ??
        "-"
    );

    console.log("");


    /*
     * AddItem XML erzeugen
     */
    console.log(
        "Erstelle AddItem XML..."
    );


    const xml =
        await EbayXmlBuilderService.buildAddItemXML(
            card
        );


    /*
     * XML lokal speichern,
     * damit wir bei Fehlern
     * genau sehen können,
     * was an eBay gesendet wurde.
     */
    const xmlDirectory =
        path.join(
            process.cwd(),
            "xml"
        );


    fs.mkdirSync(
        xmlDirectory,
        {
            recursive: true
        }
    );


    const safeName =
        String(
            card.name ??
            "testkarte"
        )
            .replace(
                /[^a-zA-Z0-9_-]/g,
                "_"
            );


    const xmlPath =
        path.join(
            xmlDirectory,
            `REAL_TEST_${safeName}.xml`
        );


    fs.writeFileSync(
        xmlPath,
        xml,
        "utf8"
    );


    console.log(
        "XML gespeichert:"
    );

    console.log(
        xmlPath
    );

    console.log("");


    /*
     * SICHERHEITSSCHRITT
     *
     * Erst VerifyAddItem.
     *
     * Wenn Verify fehlschlägt,
     * wird KEIN echtes Listing erstellt.
     */
    console.log("========================================");
    console.log("SCHRITT 1: VERIFY ADD ITEM");
    console.log("========================================");
    console.log("");


    const isValid =
        await EbayService.verifyAddItem(
            xml
        );


    if (
        !isValid
    ) {

        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "VERIFY FEHLGESCHLAGEN"
        );

        console.log(
            "========================================"
        );

        console.log("");

        console.log(
            "Es wurde KEIN echtes Listing erstellt."
        );

        console.log("");

        process.exit(1);

    }


    console.log("");

    console.log(
        "========================================"
    );

    console.log(
        "VERIFY ERFOLGREICH"
    );

    console.log(
        "========================================"
    );

    console.log("");

    console.log(
        "Die XML wurde von eBay akzeptiert."
    );

    console.log("");

    console.log(
        "Jetzt wird EIN echtes Listing erstellt."
    );

    console.log("");


    /*
     * AB HIER WIRD DAS
     * ECHTE EBAY LISTING
     * ERSTELLT.
     *
     * Es wird weiterhin
     * nur cards[0] verwendet.
     */
    console.log(
        "========================================"
    );

    console.log(
        "SCHRITT 2: ADD ITEM"
    );

    console.log(
        "========================================"
    );

    console.log("");


    const result =
        await EbayService.addItem(
            xml
        );


    console.log("");

    console.log(
        "========================================"
    );

    console.log(
        "ECHTES LISTING ERFOLGREICH ABGESCHLOSSEN"
    );

    console.log(
        "========================================"
    );

    console.log("");

    console.log(
        "eBay Antwort:"
    );

    console.log(
        result
    );

    console.log("");

}


main()
    .catch(
        error => {

            console.error("");

            console.error(
                "========================================"
            );

            console.error(
                "FEHLER BEIM EBAY LISTING"
            );

            console.error(
                "========================================"
            );

            console.error("");

            console.error(
                error
            );

            console.error("");

            process.exit(1);

        }
    );
