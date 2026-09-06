import type { Card } from "#types/payload";
import ImageUploadService from "#services/ImageUploadService";

class EbayXmlBuilderService {
    /**
     * XML-Sonderzeichen maskieren.
     */
    private static escapeXml(value: unknown): string {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    /**
     * Preis sauber formatieren.
     */
    private static formatPrice(price: number): string {
        const numericPrice = Number(price);

        if (
            !Number.isFinite(numericPrice) ||
            numericPrice <= 0
        ) {
            throw new Error(
                `Ungültiger Preis: ${price}`
            );
        }

        return numericPrice.toFixed(2);
    }

    /**
     * Menge ermitteln.
     */
    private static getQuantity(card: Card): number {
        const quantity = Number(card.quantity ?? 1);

        if (
            !Number.isInteger(quantity) ||
            quantity < 1
        ) {
            throw new Error(
                `Ungültige Menge für "${card.name}": ${quantity}`
            );
        }

        return quantity;
    }

    /**
     * Angebotsart bestimmen.
     *
     * Wenn price gesetzt ist:
     * Sofort-Kaufen
     *
     * Sonst:
     * Auktion
     */
    private static getListingType(
        card: Card
    ): "Chinese" | "FixedPriceItem" {

        /*
         * Angebotsart:
         *
         * auction → klassische Auktion
         *
         * fixed oder keine Angabe →
         * Sofort-Kaufen als Standard
         */
        if (
            (card as any).listingMode === "auction"
        ) {
            return "Chinese";
        }

        return "FixedPriceItem";
    }

    /**
     * eBay-Titel erzeugen.
     *
     * Maximal 80 Zeichen.
     */
    private static computeTitle(card: Card): string {

        /*
         * Falls bereits ein Titel durch den
         * ListingService erzeugt wurde, verwenden
         * wir genau diesen Titel.
         *
         * Dadurch sind Listing-Vorschau und
         * tatsächliches eBay-Listing identisch.
         */
        const existingTitle =
            String(
                (card as any).title ||
                ""
            ).trim();

        if (
            existingTitle
        ) {

            return this.escapeXml(
                existingTitle.slice(0, 80)
            );

        }


        /*
         * Fallback:
         *
         * Falls kein vorberechneter Titel vorhanden
         * ist, verwenden wir die bisherige
         * Titelgenerierung.
         */
        const language =
            String(
                (card as any).language ||
                ""
            ).toLowerCase();

        const germanName =
            String(
                (card as any).germanName ||
                ""
            ).trim();

        const englishName =
            String(
                (card as any).englishName ||
                ""
            ).trim();

        const originalName =
            String(
                card.name ||
                ""
            ).trim();

        /*
         * Kartennummer erzeugen.
         *
         * Beispiel:
         *
         * number = 019
         * setCardTotal = 165
         *
         * Ergebnis:
         *
         * 019/165
         */
        let formattedNumber = "";

        if (card.number) {
            const cardNumber =
                String(card.number).trim();

            const setCardTotal =
                Number(
                    (card as any).setCardTotal
                );

            if (
                Number.isFinite(setCardTotal) &&
                setCardTotal > 0 &&
                !cardNumber.includes("/")
            ) {
                formattedNumber =
                    `${cardNumber.padStart(3, "0")}/${setCardTotal}`;
            } else {
                const match =
                    cardNumber.match(
                        /^(\d+)\s*\/\s*(\d+)$/
                    );

                if (match) {
                    formattedNumber =
                        `${match[1].padStart(3, "0")}/${match[2]}`;
                } else {
                    formattedNumber =
                        cardNumber;
                }
            }
        }

        const setName =
            String(
                (card as any).setName ||
                (typeof (card as any).set === "object"
                    ? (card as any).set?.name
                    : "") ||
                card.set ||
                ""
            ).trim();

        /*
         * Japanische Karten:
         *
         * Deutscher Name Englischer Name
         * - Kartennummer/Setnummer Setname
         * - japanisch
         *
         * Beispiel:
         *
         * Rattfratz Rattata
         * - 019/165 Pokémon 151
         * - japanisch
         */
        if (language === "ja") {
            const nameParts: string[] = [];

            if (germanName) {
                nameParts.push(germanName);
            }

            if (
                englishName &&
                englishName !== germanName
            ) {
                nameParts.push(englishName);
            }

            /*
             * Falls keine Übersetzungen vorhanden sind,
             * bleibt wenigstens der originale Name erhalten.
             */
            if (nameParts.length === 0 && originalName) {
                nameParts.push(originalName);
            }

            const titleParts: string[] = [];

            if (nameParts.length > 0) {
                titleParts.push(
                    nameParts.join(" ")
                );
            }

            const cardInfo =
                [
                    formattedNumber,
                    setName
                ]
                    .filter(Boolean)
                    .join(" ");

            if (cardInfo) {
                titleParts.push(cardInfo);
            }

            titleParts.push("japanisch");

            const title =
                titleParts.join(" - ");

            return this.escapeXml(
                title.slice(0, 80)
            );
        }

        /*
         * Bestehende Standardlogik
         * für nicht-japanische Karten.
         */
        const parts: string[] = [
            "Pokémon Karte",
        ];

        if (originalName) {
            parts.push(originalName);
        }

        if (formattedNumber) {
            parts.push(formattedNumber);
        }

        if (setName) {
            parts.push(setName);
        }

        if (card.promo) {
            parts.push("Promo");
        }

        if (card.reverseHolo) {
            parts.push("Reverse Holo");
        } else if (card.holo) {
            parts.push("Holo");
        }

        if (card.isGraded) {
            if (
                card.gradeCompany &&
                card.grade !== undefined &&
                card.grade !== null
            ) {
                parts.push(
                    `${card.gradeCompany} ${card.grade}`
                );
            } else {
                parts.push("Graded");
            }
        }

        const title =
            parts
                .filter(Boolean)
                .join(" - ");

        return this.escapeXml(
            title.slice(0, 80)
        );
    }

    /**
     * Bilder hochladen und PictureDetails erzeugen.
     *
     * Unterstützt mehrere Bilder.
     */
    private static async buildPictureDetailsXML(
        card: Card
    ): Promise<string> {
        if (
            !Array.isArray(card.images) ||
            card.images.length === 0
        ) {
            throw new Error(
                `Keine Bilder für "${card.name}" vorhanden.`
            );
        }

        console.log(
            `\nLade ${card.images.length} Bild(er) hoch...`
        );

        const imageUrls =
            await ImageUploadService.uploadMultipleImages(
                card.images
            );

        if (
            !Array.isArray(imageUrls) ||
            imageUrls.length === 0
        ) {
            throw new Error(
                "Es konnte keine Bild-URL erzeugt werden."
            );
        }

        const pictureUrls = imageUrls
            .map(
                (imageUrl) =>
                    `<PictureURL>${this.escapeXml(
                        imageUrl
                    )}</PictureURL>`
            )
            .join("\n");

        return `
<PictureDetails>
${pictureUrls}
</PictureDetails>`;
    }

    /**
     * Item Specifics erzeugen.
     */
    private static buildItemSpecificsXML(
        card: Card
    ): string {
        const specifics: Array<{
            name: string;
            value: string;
        }> = [];

        /*
         * Fallback aus deinem bisherigen Projekt.
         */
        specifics.push({
            name: "Spiel",
            value: "Pokémon",
        });

        if (card.number) {
            specifics.push({
                name: "Kartennummer",
                value: String(card.number),
            });
        }

        if (card.set) {
            specifics.push({
                name: "Set",
                value: String(card.set),
            });
        }

        if (card.language) {
            specifics.push({
                name: "Sprache",
                value: String(card.language),
            });
        }

        if (card.promo) {
            specifics.push({
                name: "Besonderheiten",
                value: "Promo",
            });
        }

        if (card.reverseHolo) {
            specifics.push({
                name: "Besonderheiten",
                value: "Reverse Holo",
            });
        } else if (card.holo) {
            specifics.push({
                name: "Besonderheiten",
                value: "Holo",
            });
        }

        if (card.isGraded) {
            specifics.push({
                name: "Zustand",
                value: "Gegradet",
            });

            if (card.gradeCompany) {
                specifics.push({
                    name: "Bewertungsunternehmen",
                    value: String(
                        card.gradeCompany
                    ),
                });
            }

            if (
                card.grade !== undefined &&
                card.grade !== null
            ) {
                specifics.push({
                    name: "Bewertung",
                    value: String(card.grade),
                });
            }
        }

        // Zustand wird nicht als separates Item Specific gesendet.
        // Der erforderliche Kartenzustand wird separat gesetzt.

        const nameValueLists = specifics
            .map(
                (specific) => `
<NameValueList>
    <Name>${this.escapeXml(
        specific.name
    )}</Name>
    <Value>${this.escapeXml(
        specific.value
    )}</Value>
</NameValueList>`
            )
            .join("");

        return `
<ItemSpecifics>
<NameValueList>
    <Name>Kartenzustand</Name>
    <Value>Near Mint oder besser</Value>
</NameValueList>

<NameValueList>
    <Name>Zustand</Name>
    <Value>Ungraded</Value>
</NameValueList>

${nameValueLists}
</ItemSpecifics>`;
    }

    /**
     * Artikelbeschreibung erzeugen.
     */
    private static buildDescription(
        card: Card,
        listingType: "Chinese" | "FixedPriceItem",
        quantity: number
    ): string {
        const details: string[] = [];

        details.push(
            `${card.name ?? ""} ${card.number ?? ""}`.trim()
        );

        if (card.set) {
            details.push(
                `Set: ${card.set}`
            );
        }

        if (card.language) {
            details.push(
                `Sprache: ${card.language === "ja" ? "Japanisch" : card.language}`
            );
        }

        if (card.promo) {
            details.push(
                "Besonderheit: Promo"
            );
        }

        if (card.reverseHolo) {
            details.push(
                "Besonderheit: Reverse Holo"
            );
        } else if (card.holo) {
            details.push(
                "Besonderheit: Holo"
            );
        }

        if (card.isGraded) {
            let gradingText =
                "Zustand: Gegradet";

            if (card.gradeCompany) {
                gradingText +=
                    ` – ${card.gradeCompany}`;
            }

            if (
                card.grade !== undefined &&
                card.grade !== null
            ) {
                gradingText +=
                    ` ${card.grade}`;
            }

            details.push(gradingText);
        } else if (card.condition) {
            details.push(
                `Zustand: ${card.condition}`
            );
        }

        if (
            listingType === "FixedPriceItem"
        ) {
            details.push(
                "Angebotsart: Sofort-Kaufen"
            );
        } else {
            details.push(
                "Angebotsart: Auktion"
            );
        }

        if (quantity > 1) {
            details.push(
                `Verfügbare Menge: ${quantity} Stück`
            );
        }

        details.push("");
        details.push(
            "Original Pokémon Sammelkarte."
        );
        details.push("");
        details.push(
            "Die Karte wird sorgfältig verpackt und versendet."
        );
        details.push("");
        details.push(
            "Bei mehreren gekauften Karten werden die Versandkosten nach Möglichkeit zusammengefasst. Sollte der tatsächlich anfallende Versand günstiger sein als der berechnete Versandbetrag, erstatte ich Ihnen die zu viel gezahlten Versandkosten automatisch."
        );
        details.push("");
        details.push("");
        details.push(
            "Schauen Sie sich gerne auch meine weiteren Angebote an – vielleicht ist noch die eine oder andere Karte für Sie dabei."
        );
        details.push("");
        details.push(
            "Bei Fragen können Sie mich gerne über eBay kontaktieren."
        );

        return `<![CDATA[
${details.join("\n")}
]]>`;
    }

    /**
     * Rückgaberecht.
     */
    private static buildReturnPolicyXML(): string {
        return `
<ReturnPolicy>
    <ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption>
</ReturnPolicy>`;
    }

    /**
     * Versanddetails.
     */
    private static buildShippingDetailsXML(): string {
        const shippingCostRaw =
            process.env.EBAY_SHIPPING_COST ?? "1.10";

        const shippingCost = Number(shippingCostRaw.replace(",", "."));

        if (
            !Number.isFinite(shippingCost) ||
            shippingCost < 0
        ) {
            throw new Error(
                `Ungültige Versandkosten: ${shippingCostRaw}`
            );
        }

        const environment =
            (
                process.env.EBAY_ENVIRONMENT ??
                "sandbox"
            ).toLowerCase();

        /*
         * Der Service wurde mit GeteBayDetails geprüft.
         *
         * DE_DeutschePostBrief ist gültig und ein
         * nationaler Versandservice.
         *
         * Über die .env kann der Wert weiterhin für
         * Sandbox und Produktion separat überschrieben werden.
         */
        const shippingService =
            environment === "production"
                ? (
                    process.env
                        .EBAY_SHIPPING_SERVICE_PRODUCTION ??
                    "DE_DeutschePostBrief"
                )
                : (
                    process.env
                        .EBAY_SHIPPING_SERVICE_SANDBOX ??
                    "DE_DeutschePostBrief"
                );

        const postalCode =
            process.env.EBAY_POSTAL_CODE ??
            "53859";

        console.log(
            "\nVERSANDKONFIGURATION:"
        );

        console.log(
            "Land: Deutschland"
        );

        console.log(
            "PLZ:",
            postalCode
        );

        console.log(
            `Versandkosten: ${shippingCost.toFixed(2)} EUR`
        );

        console.log(
            `Umgebung: ${environment}`
        );

        console.log(
            `Versandservice: ${shippingService}`
        );

        return `
<ShippingDetails>
    <ShippingType>Flat</ShippingType>

    <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>

        <ShippingService>${this.escapeXml(
            shippingService
        )}</ShippingService>

        <ShippingServiceCost currencyID="EUR">${shippingCost.toFixed(
            2
        )}</ShippingServiceCost>
    </ShippingServiceOptions>
</ShippingDetails>`;
    }

    /**
     * Listing- und Preis-XML erzeugen.
     */
    private static buildListingPriceXML(
        card: Card,
        listingType: "Chinese" | "FixedPriceItem"
    ): string {
        if (
            listingType === "FixedPriceItem"
        ) {
            if (
                card.price === undefined ||
                card.price === null
            ) {
                throw new Error(
                    `Für Sofort-Kaufen fehlt der Preis bei "${card.name}".`
                );
            }

            return `
<ListingType>FixedPriceItem</ListingType>

<StartPrice currencyID="EUR">${this.formatPrice(
    Number(card.price)
)}</StartPrice>`;
        }

        const startPrice =
            card.startPrice ?? 1.00;

        return `
<ListingType>Chinese</ListingType>

<StartPrice currencyID="EUR">${this.formatPrice(
    Number(startPrice)
)}</StartPrice>`;
    }

    /**
     * Optional Best Offer.
     */
    private static buildBestOfferXML(
        card: Card
    ): string {
        if (
            card.minimumBestOfferAmount === undefined ||
            card.minimumBestOfferAmount === null
        ) {
            return "";
        }

        return `
<BestOfferDetails>
    <BestOfferEnabled>true</BestOfferEnabled>

    <MinimumBestOfferPrice currencyID="EUR">${this.formatPrice(
        Number(card.minimumBestOfferAmount)
    )}</MinimumBestOfferPrice>
</BestOfferDetails>`;
    }

    /**
     * AddItem XML erzeugen.
     */
    static async buildAddItemXML(
        card: Card
    ): Promise<string> {
        console.log(
            "\n========================================"
        );

        console.log(
            "ERSTELLE EBAY ADDITEM XML"
        );

        console.log(
            "========================================"
        );

        /*
         * Grundwerte bestimmen.
         */
        const listingType =
            this.getListingType(card);

        const quantity =
            this.getQuantity(card);

        console.log("\nARTIKELDATEN:");

        console.log(
            "Name:",
            card.name
        );

        console.log(
            "Angebotsart:",
            listingType === "FixedPriceItem"
                ? "Sofort-Kaufen"
                : "Auktion"
        );

        console.log(
            "Menge:",
            quantity
        );

        if (
            listingType === "FixedPriceItem"
        ) {
            console.log(
                "Sofort-Kaufen Preis:",
                card.price
            );
        } else {
            console.log(
                "Auktions-Startpreis:",
                card.startPrice ?? 1.00
            );
        }

        /*
         * Bilder hochladen.
         */
        const pictureDetailsXML =
            await this.buildPictureDetailsXML(
                card
            );

        /*
         * Titel.
         */
        const title =
            this.computeTitle(card);

        /*
         * Item Specifics.
         */
        console.log(
            "\n========================================"
        );

        console.log(
            "ERSTELLE EBAY ITEM SPECIFICS"
        );

        console.log(
            "========================================"
        );

        const itemSpecificsXML =
            this.buildItemSpecificsXML(
                card
            );

        /*
         * Beschreibung.
         */
        const description =
            this.buildDescription(
                card,
                listingType,
                quantity
            );

        /*
         * Preis.
         */
        const listingPriceXML =
            this.buildListingPriceXML(
                card,
                listingType
            );

        /*
         * Best Offer nur bei Sofort-Kaufen.
         */
        const bestOfferXML =
            listingType === "FixedPriceItem"
                ? this.buildBestOfferXML(card)
                : "";

        /*
         * Konfiguration.
         */
        const postalCode =
            process.env.EBAY_POSTAL_CODE ??
            "53859";

        const categoryId =
            process.env.EBAY_CATEGORY_ID ??
            "183454";

        /*
         * XML erstellen.
         *
         * WICHTIG:
         * RequesterCredentials werden hier NICHT eingefügt.
         *
         * EbayService.ts fügt den Token später
         * direkt vor dem Request ein.
         */
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">

    <ErrorLanguage>en_US</ErrorLanguage>

    <WarningLevel>High</WarningLevel>

    <Item>

        <Site>Germany</Site>

        ${pictureDetailsXML}

        <Title>${title}</Title>

        <PrimaryCategory>
            <CategoryID>${this.escapeXml(
                categoryId
            )}</CategoryID>
        </PrimaryCategory>

        <ConditionID>${this.escapeXml(
            process.env.EBAY_CONDITION_ID ?? "3000"
        )}</ConditionID>

        <ConditionDescriptors>
            <ConditionDescriptor>
                <Name>40001</Name>
                <Value>${this.escapeXml(
                    process.env.EBAY_CARD_CONDITION ?? "400010"
                )}</Value>
            </ConditionDescriptor>
        </ConditionDescriptors>

        ${itemSpecificsXML}

        <Description>${description}</Description>

        <ListingDuration>${
            listingType === "FixedPriceItem"
                ? "GTC"
                : "Days_7"
        }</ListingDuration>

        ${listingPriceXML}

        <Quantity>${quantity}</Quantity>

        ${bestOfferXML}

        <Country>DE</Country>

        <Currency>EUR</Currency>

        <DispatchTimeMax>3</DispatchTimeMax>

        <PostalCode>${this.escapeXml(
            postalCode
        )}</PostalCode>

        ${this.buildReturnPolicyXML()}

        ${this.buildShippingDetailsXML()}

    </Item>

</AddItemRequest>`;

        console.log(
            "\n========================================"
        );

        console.log(
            "XML ERFOLGREICH ERSTELLT"
        );

        console.log(
            "========================================"
        );

        console.log("\nRETURN POLICY:");

        console.log(
            "ReturnsAcceptedOption: ReturnsNotAccepted"
        );

        return xml;
    }
}

export default EbayXmlBuilderService;