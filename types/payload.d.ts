import type {
    EbayConditions
} from "#types/ebay";

type Card = {
    name: string;

    number: string;

    set: string;

    language: string;

    /*
     * Dateinamen der Bilder.
     *
     * Beispiel:
     * ["img1234.jpeg", "back.jpeg"]
     */
    images: string[];

    /*
     * Grading.
     */
    isGraded: boolean;

    grade?: number;

    gradeCompany?: string;

    /*
     * Angebotsart.
     *
     * Wenn price gesetzt ist:
     * Sofort-Kaufen.
     *
     * Wenn nur startPrice gesetzt ist:
     * Auktion.
     */
    startPrice?: number;

    price?: number;

    /*
     * Zustand.
     */
    condition?: EbayConditions;

    /*
     * Anzahl gleicher Karten.
     */
    quantity?: number;

    /*
     * Mindestpreis für Preisvorschläge.
     *
     * Optional.
     */
    minimumBestOfferAmount?: number;

    /*
     * Karten-Besonderheiten.
     */
    promo?: boolean;

    reverseHolo?: boolean;

    holo?: boolean;
};

export type {
    Card
};