import "dotenv/config";

import fetch from "node-fetch";

const SANDBOX_URL =
    "https://api.sandbox.ebay.com/ws/api.dll";

const PRODUCTION_URL =
    "https://api.ebay.com/ws/api.dll";

const ENVIRONMENT =
    (process.env.EBAY_ENVIRONMENT || "sandbox")
        .toLowerCase();

const SITE_ID = "77";

const COMPATIBILITY_LEVEL = "1477";

const SANDBOX_TOKEN =
    process.env.EBAY_AUTH_TOKEN_SANDBOX;

const PRODUCTION_TOKEN =
    process.env.EBAY_AUTH_TOKEN_PRODUCTION;

const SANDBOX_APP_ID =
    process.env.EBAY_APP_ID_SANDBOX;

const SANDBOX_DEV_ID =
    process.env.EBAY_DEV_ID_SANDBOX;

const SANDBOX_CERT_ID =
    process.env.EBAY_CERT_ID_SANDBOX;

const PRODUCTION_APP_ID =
    process.env.EBAY_APP_ID_PRODUCTION;

const PRODUCTION_DEV_ID =
    process.env.EBAY_DEV_ID_PRODUCTION;

const PRODUCTION_CERT_ID =
    process.env.EBAY_CERT_ID_PRODUCTION;


type EbayConfig = {
    environment: "sandbox" | "production";
    url: string;
    token: string;
    appId: string;
    devId: string;
    certId: string;
};


function getConfig(): EbayConfig {

    if (ENVIRONMENT === "production") {

        if (!PRODUCTION_TOKEN) {
            throw new Error(
                "EBAY_AUTH_TOKEN_PRODUCTION wurde nicht gefunden."
            );
        }

        if (!PRODUCTION_APP_ID) {
            throw new Error(
                "EBAY_APP_ID_PRODUCTION wurde nicht gefunden."
            );
        }

        if (!PRODUCTION_DEV_ID) {
            throw new Error(
                "EBAY_DEV_ID_PRODUCTION wurde nicht gefunden."
            );
        }

        if (!PRODUCTION_CERT_ID) {
            throw new Error(
                "EBAY_CERT_ID_PRODUCTION wurde nicht gefunden."
            );
        }

        return {
            environment: "production",
            url: PRODUCTION_URL,
            token: PRODUCTION_TOKEN.trim(),
            appId: PRODUCTION_APP_ID.trim(),
            devId: PRODUCTION_DEV_ID.trim(),
            certId: PRODUCTION_CERT_ID.trim(),
        };
    }


    if (!SANDBOX_TOKEN) {
        throw new Error(
            "EBAY_AUTH_TOKEN_SANDBOX wurde nicht gefunden."
        );
    }

    if (!SANDBOX_APP_ID) {
        throw new Error(
            "EBAY_APP_ID_SANDBOX wurde nicht gefunden."
        );
    }

    if (!SANDBOX_DEV_ID) {
        throw new Error(
            "EBAY_DEV_ID_SANDBOX wurde nicht gefunden."
        );
    }

    if (!SANDBOX_CERT_ID) {
        throw new Error(
            "EBAY_CERT_ID_SANDBOX wurde nicht gefunden."
        );
    }

    return {
        environment: "sandbox",
        url: SANDBOX_URL,
        token: SANDBOX_TOKEN.trim(),
        appId: SANDBOX_APP_ID.trim(),
        devId: SANDBOX_DEV_ID.trim(),
        certId: SANDBOX_CERT_ID.trim(),
    };
}


/**
 * XML-Text maskieren.
 *
 * Wichtig:
 * Auch der Token wird hierdurch XML-sicher gemacht.
 */
function escapeXml(value: string): string {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}


/**
 * Entfernt vorhandene RequesterCredentials und
 * fügt genau einen sauberen Credentials-Block ein.
 */
function insertTokenIntoXml(
    originalXml: string,
    token: string
): string {

    let xml = originalXml;

    /**
     * Vorhandene Credentials entfernen.
     */
    xml = xml.replace(
        /<RequesterCredentials>[\s\S]*?<\/RequesterCredentials>/g,
        ""
    );

    const requesterCredentials =
        `<RequesterCredentials><eBayAuthToken>${escapeXml(
            token.trim()
        )}</eBayAuthToken></RequesterCredentials>`;

    /**
     * Credentials direkt nach dem Request-Starttag einfügen.
     */
    const result = xml.replace(
        /(<(?:AddItem|VerifyAddItem)Request\b[^>]*>)/,
        `$1${requesterCredentials}`
    );

    if (result === xml) {
        throw new Error(
            "Konnte RequesterCredentials nicht in das eBay XML einfügen."
        );
    }

    return result;
}


/**
 * AddItem XML in VerifyAddItem XML umwandeln.
 */
function convertToVerifyAddItemXml(
    originalXml: string
): string {

    return originalXml
        .replace(
            /<AddItemRequest\b/g,
            "<VerifyAddItemRequest"
        )
        .replace(
            /<\/AddItemRequest>/g,
            "</VerifyAddItemRequest>"
        );
}


/**
 * Ack lesen.
 */
function parseAck(
    xml: string
): string | undefined {

    return xml
        .match(/<Ack>([\s\S]*?)<\/Ack>/)?.[1]
        ?.trim();
}


/**
 * ItemID lesen.
 */
function parseItemId(
    xml: string
): string | undefined {

    return xml
        .match(/<ItemID>([\s\S]*?)<\/ItemID>/)?.[1]
        ?.trim();
}


/**
 * eBay-Fehler lesen.
 */
function parseErrors(xml: string) {

    const matches = [
        ...xml.matchAll(
            /<Errors>([\s\S]*?)<\/Errors>/g
        ),
    ];

    return matches.map((match) => {

        const block = match[1];

        return {
            shortMessage:
                block
                    .match(
                        /<ShortMessage>([\s\S]*?)<\/ShortMessage>/
                    )?.[1]
                    ?.trim()
                ?? "Unbekannter Fehler",

            longMessage:
                block
                    .match(
                        /<LongMessage>([\s\S]*?)<\/LongMessage>/
                    )?.[1]
                    ?.trim()
                ?? "",

            errorCode:
                block
                    .match(
                        /<ErrorCode>([\s\S]*?)<\/ErrorCode>/
                    )?.[1]
                    ?.trim()
                ?? "",
        };
    });
}


function decodeEntities(
    value: string
): string {

    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}


function printErrors(
    responseText: string
): void {

    const errors =
        parseErrors(responseText);

    if (errors.length === 0) {

        console.log(
            "Keine detaillierten eBay-Fehler gefunden."
        );

        return;
    }

    for (
        const [index, error]
        of errors.entries()
    ) {

        console.log(
            `\n${index + 1}. ${decodeEntities(
                error.shortMessage
            )}`
        );

        if (error.longMessage) {

            console.log(
                "   Details:",
                decodeEntities(
                    error.longMessage
                )
            );
        }

        if (error.errorCode) {

            console.log(
                "   ErrorCode:",
                error.errorCode
            );
        }
    }
}


function isSuccessfulAck(
    ack: string | undefined
): boolean {

    return (
        ack === "Success" ||
        ack === "Warning"
    );
}


/**
 * eBay Trading API Request.
 */
async function callEbay(
    callName: "VerifyAddItem" | "AddItem",
    xml: string
): Promise<string> {

    const config =
        getConfig();

    console.log(
        "\n========================================"
    );

    console.log(
        `SENDE ${callName} AN EBAY`
    );

    console.log(
        "========================================"
    );

    const response = await fetch(
        config.url,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "text/xml; charset=utf-8",

                "X-EBAY-API-CALL-NAME":
                    callName,

                "X-EBAY-API-SITEID":
                    SITE_ID,

                "X-EBAY-API-COMPATIBILITY-LEVEL":
                    COMPATIBILITY_LEVEL,

                "X-EBAY-API-APP-NAME":
                    config.appId,

                "X-EBAY-API-DEV-NAME":
                    config.devId,

                "X-EBAY-API-CERT-NAME":
                    config.certId,
            },

            body: xml,
        }
    );

    const responseText =
        await response.text();

    console.log(
        "\n========================================"
    );

    console.log(
        `EBAY ANTWORT – ${callName}`
    );

    console.log(
        "========================================"
    );

    console.log(
        "HTTP Status:",
        response.status
    );

    console.log(
        "HTTP OK:",
        response.ok
    );

    console.log("");

    console.log(responseText);

    console.log(
        "========================================\n"
    );

    return responseText;
}


class EbayService {

    /**
     * Listing prüfen, ohne es zu erstellen.
     */
    static async verifyAddItem(
        originalXml: string
    ): Promise<boolean> {

        const config =
            getConfig();

        console.log(
            "\n========================================"
        );

        console.log(
            "VERIFY ADD ITEM"
        );

        console.log(
            "========================================"
        );

        console.log(
            "Umgebung:",
            config.environment
        );

        console.log(
            "API URL:",
            config.url
        );

        console.log(
            "SiteID:",
            SITE_ID
        );

        let verifyXml =
            convertToVerifyAddItemXml(
                originalXml
            );

        verifyXml =
            insertTokenIntoXml(
                verifyXml,
                config.token
            );

        /**
         * Sehr wichtig:
         * Das tatsächlich gesendete XML speichern,
         * damit wir bei einem Fehler exakt sehen,
         * was eBay erhalten hat.
         */
        console.log(
            "\nVERIFY XML VORSCHAU:"
        );

        console.log(
            "----------------------------------------"
        );

        console.log(
            verifyXml
                .split("\n")
                .slice(0, 30)
                .map(
                    (line, index) =>
                        `${String(index + 1).padStart(3, " ")} | ${line}`
                )
                .join("\n")
        );

        console.log(
            "----------------------------------------"
        );

        const responseText =
            await callEbay(
                "VerifyAddItem",
                verifyXml
            );

        const ack =
            parseAck(responseText);

        console.log(
            "VERIFY ACK:",
            ack ?? "nicht gefunden"
        );

        if (
            isSuccessfulAck(ack)
        ) {

            console.log(
                "\n✓ VERIFY ADD ITEM ERFOLGREICH"
            );

            console.log(
                "Das Listing ist technisch gültig."
            );

            console.log(
                "Es wurde KEIN echtes Listing erstellt."
            );

            return true;
        }

        console.log(
            "\n❌ VERIFY ADD ITEM FEHLGESCHLAGEN"
        );

        printErrors(
            responseText
        );

        return false;
    }


    /**
     * Echtes Listing erstellen.
     */
    static async addItem(
        originalXml: string
    ): Promise<void> {

        const config =
            getConfig();

        console.log(
            "\n========================================"
        );

        console.log(
            "SENDE ADDITEM REQUEST AN EBAY"
        );

        console.log(
            "========================================"
        );

        console.log(
            "Umgebung:",
            config.environment
        );

        console.log(
            "API URL:",
            config.url
        );

        console.log(
            "SiteID:",
            SITE_ID
        );

        const xml =
            insertTokenIntoXml(
                originalXml,
                config.token
            );

        const responseText =
            await callEbay(
                "AddItem",
                xml
            );

        const ack =
            parseAck(responseText);

        if (
            isSuccessfulAck(ack)
        ) {

            const itemId =
                parseItemId(
                    responseText
                );

            console.log(
                "\n✓ EBAY HAT DEN ARTIKEL AKZEPTIERT"
            );

            console.log(
                "ItemID:",
                itemId ?? "nicht gefunden"
            );

            return;
        }

        console.log(
            "\n❌ EBAY HAT DEN ARTIKEL NICHT AKZEPTIERT"
        );

        printErrors(
            responseText
        );

        throw new Error(
            "eBay AddItem Request wurde abgelehnt."
        );
    }
}


export default EbayService;