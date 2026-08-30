type CardSearchResult = {
    id: string;
    name: string;
    localId: string;
    image?: string;
    set?: {
        id: string;
        name: string;
        cardCount?: {
            official?: number;
            total?: number;
        };
    };
};

class CardDatabaseService {
    private readonly baseUrl =
        'https://api.tcgdex.net/v2/de/cards';

    async searchCard(
        cardNumber: string,
        cardName?: string
    ): Promise<CardSearchResult | null> {
        try {
            const normalizedNumber =
                cardNumber.trim();

            const normalizedName =
                cardName?.toLowerCase().trim() ?? '';

            const [localNumber, totalNumber] =
                normalizedNumber.split('/');

            if (!localNumber || !totalNumber) {
                console.log(
                    'Ungültige Kartennummer:',
                    cardNumber
                );

                return null;
            }

            const response = await fetch(
                this.baseUrl
            );

            if (!response.ok) {
                throw new Error(
                    `TCGdex API Fehler: ${response.status}`
                );
            }

            const cards: CardSearchResult[] =
                await response.json();

            const numberMatches = cards.filter(
                (card) =>
                    card.localId === localNumber
            );

            console.log(
                `Karten mit Nummer ${localNumber}: ${numberMatches.length}`
            );

            const candidates: CardSearchResult[] = [];

            for (const card of numberMatches) {
                const detailResponse = await fetch(
                    `${this.baseUrl}/${card.id}`
                );

                if (!detailResponse.ok) {
                    continue;
                }

                const detail = await detailResponse.json();

                const officialCount =
                    detail.set?.cardCount?.official;

                const totalCount =
                    detail.set?.cardCount?.total;

                const setMatches =
                    String(officialCount) === totalNumber ||
                    String(totalCount) === totalNumber;

                if (!setMatches) {
                    continue;
                }

                candidates.push({
                    id: detail.id,
                    name: detail.name,
                    localId: detail.localId,
                    image: detail.image,
                    set: detail.set
                });
            }

            console.log(
                `Passende Karten nach Set-Prüfung: ${candidates.length}`
            );

            if (candidates.length === 0) {
                return null;
            }

            if (candidates.length === 1) {
                return candidates[0];
            }

            if (normalizedName) {
                const nameMatch = candidates.find(
                    (card) =>
                        card.name
                            .toLowerCase()
                            .trim() === normalizedName
                );

                if (nameMatch) {
                    console.log(
                        `Passender Name gefunden: ${nameMatch.name}`
                    );

                    return nameMatch;
                }
            }

            console.log(
                'Mehrere Karten mit derselben Nummer und Setgröße gefunden.'
            );

            return null;
        } catch (error) {
            console.error(
                'Fehler bei der Kartensuche:',
                error
            );

            return null;
        }
    }
}

export default new CardDatabaseService();
