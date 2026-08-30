import "dotenv/config";
import fetch from "node-fetch";

const token = process.env.EBAY_AUTH_TOKEN_SANDBOX;

if (!token) {
    throw new Error(
        "EBAY_AUTH_TOKEN_SANDBOX wurde nicht gefunden."
    );
}

const API_URL = "https://api.sandbox.ebay.com/ws/api.dll";

const xml = `<?xml version="1.0" encoding="utf-8"?>
<GeteBayDetailsRequest xmlns="urn:ebay:apis:eBLBaseComponents">

    <RequesterCredentials>
        <eBayAuthToken>${token}</eBayAuthToken>
    </RequesterCredentials>

    <DetailName>ShippingServiceDetails</DetailName>

</GeteBayDetailsRequest>`;

function getTagValue(
    block: string,
    tag: string
): string | undefined {
    const regex = new RegExp(
        `<${tag}>([\\s\\S]*?)<\\/${tag}>`
    );

    return block.match(regex)?.[1]?.trim();
}

async function getShippingServices() {
    console.log("========================================");
    console.log("EBAY DEUTSCHLAND – VERSANDSERVICES");
    console.log("========================================");

    const response = await fetch(API_URL, {
        method: "POST",

        headers: {
            "Content-Type": "text/xml",

            "X-EBAY-API-CALL-NAME":
                "GeteBayDetails",

            "X-EBAY-API-SITEID":
                "77",

            "X-EBAY-API-COMPATIBILITY-LEVEL":
                "1477",
        },

        body: xml,
    });

    const responseText = await response.text();

    console.log("");
    console.log("HTTP Status:", response.status);

    if (!response.ok) {
        console.log("");
        console.log("eBay Antwort:");
        console.log(responseText);
        return;
    }

    console.log("");
    console.log("========================================");
    console.log("SUCHE NACH DEUTSCHE POST BRIEF SERVICES");
    console.log("========================================");

    const services = [
        ...responseText.matchAll(
            /<ShippingServiceDetails>([\s\S]*?)<\/ShippingServiceDetails>/g
        ),
    ];

    let foundCount = 0;

    for (const match of services) {
        const block = match[1];

        const service =
            getTagValue(
                block,
                "ShippingService"
            );

        const description =
            getTagValue(
                block,
                "Description"
            );

        const validForSellingFlow =
            getTagValue(
                block,
                "ValidForSellingFlow"
            );

        const internationalService =
            getTagValue(
                block,
                "InternationalService"
            );

        if (!service) {
            continue;
        }

        const searchText = `
            ${service}
            ${description ?? ""}
        `.toLowerCase();

        if (
            searchText.includes("deutschepost") ||
            searchText.includes("deutsche post") ||
            searchText.includes("brief") ||
            searchText.includes("kompakt") ||
            searchText.includes("warensendung")
        ) {
            foundCount++;

            console.log("");
            console.log("----------------------------------------");
            console.log(
                "Code:        ",
                service
            );

            console.log(
                "Beschreibung:",
                description ?? "-"
            );

            console.log(
                "Gültig:      ",
                validForSellingFlow ??
                    "nicht angegeben"
            );

            console.log(
                "International:",
                internationalService ??
                    "false"
            );
        }
    }

    console.log("");
    console.log("========================================");
    console.log("ERGEBNIS");
    console.log("========================================");

    console.log(
        `Gefundene Services: ${foundCount}`
    );

    console.log("");
    console.log(
        "WICHTIG: Suche in der Ausgabe nach:"
    );

    console.log(
        "  Deutsche Post Brief Kompakt"
    );

    console.log(
        "und kopiere mir anschließend GENAU diese Zeile:"
    );

    console.log("");
    console.log("Code:         ...");
    console.log("Beschreibung: ...");
    console.log("Gültig:       ...");

    console.log("");
    console.log("========================================");
    console.log("ENDE");
    console.log("========================================");
}

getShippingServices().catch((error) => {
    console.error("");
    console.error("========================================");
    console.error("FEHLER");
    console.error("========================================");

    console.error(error);
});