import fs from 'node:fs/promises';
import path from 'node:path';

import CardOcrService from './CardOcrService.ts';

type IndexedCard = {
    id: string;
    name: string;
    localId: string;
    image?: string;
    set?: {
        id: string;
        name: string;
    };
};

export type RecognizedCard = {
    id: string;
    name: string;
    localId: string;
    cardNumber: string;
    image?: string;
    set?: {
        id: string;
        name: string;
    };
    confidence: number;
    recognitionMethod: string;
};

class CardRecognitionService {

    private readonly indexPath =
        path.resolve(
            'cache/card-image-index.json'
        );

    private normalize(
        value: string
    ): string {

        return value
            .toLowerCase()
            .normalize('NFD')
            .replace(
                /[\u0300-\u036f]/g,
                ''
            )
            .replace(
                /[^a-z0-9]/g,
                ''
            );
    }

    private normalizeNumber(
        value: string
    ): string {

        const match =
            value.match(
                /(\d{1,4})\/(\d{1,4})/
            );

        if (!match) {
            return value;
        }

        return (
            `${Number(match[1])}/${Number(match[2])}`
        );
    }

    private calculateNameSimilarity(
        a: string,
        b: string
    ): number {

        const first =
            this.normalize(a);

        const second =
            this.normalize(b);

        if (
            !first ||
            !second
        ) {
            return 0;
        }

        if (
            first === second
        ) {
            return 1;
        }

        if (
            first.includes(second) ||
            second.includes(first)
        ) {
            return 0.9;
        }

        let matches = 0;

        const maxLength =
            Math.max(
                first.length,
                second.length
            );

        const minLength =
            Math.min(
                first.length,
                second.length
            );

        for (
            let i = 0;
            i < minLength;
            i++
        ) {

            if (
                first[i] === second[i]
            ) {
                matches++;
            }
        }

        return (
            matches /
            maxLength
        );
    }

    private async loadIndex():
        Promise<IndexedCard[]> {

        const raw =
            await fs.readFile(
                this.indexPath,
                'utf8'
            );

        const parsed =
            JSON.parse(raw);

        if (
            Array.isArray(
                parsed
            )
        ) {
            return parsed;
        }

        if (
            Array.isArray(
                parsed.cards
            )
        ) {
            return parsed.cards;
        }

        throw new Error(
            'Ungültiges Kartenindex-Format.'
        );
    }

    async recognizeCard(
        imagePath: string
    ): Promise<RecognizedCard | null> {

        console.log('');
        console.log(
            '========================================'
        );

        console.log(
            'STARTE OCR-KARTENERKENNUNG'
        );

        console.log(
            '========================================'
        );

        const ocrResult =
            await CardOcrService.recognizeText(
                imagePath
            );

        console.log('');

        console.log(
            'Lade lokalen Kartenindex...'
        );

        const cards =
            await this.loadIndex();

        console.log(
            `Index geladen: ${cards.length} Karten`
        );

        const matches:
            Array<{
                card: IndexedCard;
                score: number;
                reasons: string[];
            }> = [];

        for (
            const card of cards
        ) {

            let score = 0;

            const reasons:
                string[] = [];

            for (
                const detectedNumber of
                ocrResult.cardNumbers
            ) {

                const normalizedDetected =
                    this.normalizeNumber(
                        detectedNumber
                    );

                const localId =
                    this.normalize(
                        card.localId
                    );

                const numberOnly =
                    normalizedDetected.split(
                        '/'
                    )[0];

                const normalizedNumber =
                    this.normalize(
                        numberOnly
                    );

                if (
                    localId ===
                    normalizedNumber
                ) {

                    score += 0.65;

                    reasons.push(
                        `Kartennummer ${detectedNumber}`
                    );
                }
            }

            for (
                const possibleName of
                ocrResult.possibleNames
            ) {

                const similarity =
                    this.calculateNameSimilarity(
                        possibleName,
                        card.name
                    );

                if (
                    similarity >= 0.9
                ) {

                    score +=
                        0.8 *
                        similarity;

                    reasons.push(
                        `Name ${possibleName}`
                    );

                } else if (
                    similarity >= 0.65
                ) {

                    score +=
                        0.4 *
                        similarity;
                }
            }

            if (
                score > 0
            ) {

                matches.push({
                    card,
                    score,
                    reasons
                });
            }
        }

        matches.sort(
            (
                a,
                b
            ) =>
                b.score -
                a.score
        );

        console.log('');
        console.log(
            '========================================'
        );

        console.log(
            'TOP OCR-TREFFER'
        );

        console.log(
            '========================================'
        );

        const top =
            matches.slice(
                0,
                10
            );

        for (
            let i = 0;
            i < top.length;
            i++
        ) {

            const match =
                top[i];

            console.log('');
            console.log(
                `#${i + 1}`
            );

            console.log(
                `Name: ${match.card.name}`
            );

            console.log(
                `Kartennummer: ${match.card.localId}`
            );

            console.log(
                `Set: ${
                    match.card.set?.name ||
                    'Unbekannt'
                }`
            );

            console.log(
                `Score: ${match.score.toFixed(3)}`
            );

            console.log(
                `Erkannt durch: ${
                    match.reasons.join(', ') ||
                    'Ähnlichkeit'
                }`
            );
        }

        if (
            matches.length === 0
        ) {

            console.log('');
            console.log(
                '⚠️ Keine passende Karte gefunden.'
            );

            return null;
        }

        const best =
            matches[0];

        const confidence =
            Math.min(
                100,
                Math.round(
                    best.score * 100
                )
            );

        if (
            confidence < 60
        ) {

            console.log('');
            console.log(
                `⚠️ Treffer zu unsicher: ${confidence}%`
            );

            return null;
        }

        console.log('');
        console.log(
            '========================================'
        );

        console.log(
            '✓ KARTE ERKANNT'
        );

        console.log(
            '========================================'
        );

        console.log(
            `Name: ${best.card.name}`
        );

        console.log(
            `Kartennummer: ${best.card.localId}`
        );

        console.log(
            `Set: ${
                best.card.set?.name ||
                'Unbekannt'
            }`
        );

        console.log(
            `Confidence: ${confidence}%`
        );

        return {
            id:
                best.card.id,

            name:
                best.card.name,

            localId:
                best.card.localId,

            cardNumber:
                best.card.localId,

            image:
                best.card.image,

            set:
                best.card.set,

            confidence,

            recognitionMethod:
                'OCR + lokaler Kartenindex'
        };
    }
}

export default new CardRecognitionService();
