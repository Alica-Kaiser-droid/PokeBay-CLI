import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

type TCGdexCard = {
    id: string;
    localId: string;
    name: string;
    image?: string;
    set?: {
        id: string;
        name: string;
    };
};

type ImageFeatures = {
    averageHash: string;
    differenceHash: string;
    perceptualHash: string;
    colorHistogram: number[];
};

type IndexedCard = {
    id: string;
    name: string;
    localId: string;
    image?: string;
    set?: {
        id: string;
        name: string;
    };
    features: ImageFeatures;
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
};

type SearchResult = {
    card: IndexedCard;
    score: number;
    averageDistance: number;
    differenceDistance: number;
    perceptualDistance: number;
    colorDistance: number;
};

class CardImageRecognitionService {

    private readonly cacheDirectory =
        path.resolve('./cache/cards');

    private readonly indexPath =
        path.resolve('./cache/card-image-index.json');


    private async getGrayscalePixels(
        imagePath: string,
        width: number,
        height: number
    ): Promise<Uint8Array> {

        const {
            data
        } =
            await sharp(imagePath)
                .resize(width, height, {
                    fit: 'fill'
                })
                .grayscale()
                .raw()
                .toBuffer({
                    resolveWithObject: true
                });

        return data;
    }


    private async createAverageHash(
        imagePath: string
    ): Promise<string> {

        const data =
            await this.getGrayscalePixels(
                imagePath,
                32,
                32
            );

        let sum = 0;

        for (const value of data) {
            sum += value;
        }

        const average =
            sum / data.length;

        let hash = '';

        for (const value of data) {
            hash +=
                value >= average
                    ? '1'
                    : '0';
        }

        return hash;
    }


    private async createDifferenceHash(
        imagePath: string
    ): Promise<string> {

        const width = 33;
        const height = 32;

        const data =
            await this.getGrayscalePixels(
                imagePath,
                width,
                height
            );

        let hash = '';

        for (
            let y = 0;
            y < height;
            y++
        ) {

            for (
                let x = 0;
                x < width - 1;
                x++
            ) {

                const left =
                    data[
                        y * width + x
                    ];

                const right =
                    data[
                        y * width + x + 1
                    ];

                hash +=
                    left > right
                        ? '1'
                        : '0';
            }
        }

        return hash;
    }


    /**
     * Vereinfachter perceptual Hash.
     *
     * Hier verwenden wir ein größeres,
     * weichgezeichnetes Graustufenbild.
     */
    private async createPerceptualHash(
        imagePath: string
    ): Promise<string> {

        const {
            data
        } =
            await sharp(imagePath)
                .resize(32, 32, {
                    fit: 'fill'
                })
                .grayscale()
                .blur(1)
                .raw()
                .toBuffer({
                    resolveWithObject: true
                });

        let sum = 0;

        for (const value of data) {
            sum += value;
        }

        const average =
            sum / data.length;

        let hash = '';

        for (const value of data) {
            hash +=
                value >= average
                    ? '1'
                    : '0';
        }

        return hash;
    }


    /**
     * Einfaches RGB-Farbprofil.
     *
     * Das Bild wird auf 64 x 64 reduziert.
     * Für jeden RGB-Kanal werden 16 Bereiche
     * gezählt.
     */
    private async createColorHistogram(
        imagePath: string
    ): Promise<number[]> {

        const {
            data
        } =
            await sharp(imagePath)
                .resize(64, 64, {
                    fit: 'fill'
                })
                .removeAlpha()
                .raw()
                .toBuffer({
                    resolveWithObject: true
                });

        const bins =
            new Array(48).fill(0);

        for (
            let i = 0;
            i < data.length;
            i += 3
        ) {

            const rBin =
                Math.min(
                    15,
                    Math.floor(
                        data[i] / 16
                    )
                );

            const gBin =
                Math.min(
                    15,
                    Math.floor(
                        data[i + 1] / 16
                    )
                );

            const bBin =
                Math.min(
                    15,
                    Math.floor(
                        data[i + 2] / 16
                    )
                );

            bins[rBin]++;

            bins[16 + gBin]++;

            bins[32 + bBin]++;
        }

        const total =
            (data.length / 3);

        return bins.map(
            value =>
                value / total
        );
    }


    private calculateDistance(
        hashA: string,
        hashB: string
    ): number {

        const length =
            Math.min(
                hashA.length,
                hashB.length
            );

        let distance = 0;

        for (
            let i = 0;
            i < length;
            i++
        ) {

            if (
                hashA[i] !==
                hashB[i]
            ) {
                distance++;
            }
        }

        return distance;
    }


    private calculateNormalizedHashDistance(
        hashA: string,
        hashB: string
    ): number {

        const distance =
            this.calculateDistance(
                hashA,
                hashB
            );

        const length =
            Math.max(
                hashA.length,
                hashB.length
            );

        return distance / length;
    }


    private calculateColorDistance(
        histogramA: number[],
        histogramB: number[]
    ): number {

        let distance = 0;

        const length =
            Math.min(
                histogramA.length,
                histogramB.length
            );

        for (
            let i = 0;
            i < length;
            i++
        ) {

            distance += Math.abs(
                histogramA[i] -
                histogramB[i]
            );
        }

        /*
         * Maximaldistanz normalisieren.
         */
        return distance / 6;
    }


    private async createFeatures(
        imagePath: string
    ): Promise<ImageFeatures> {

        const [
            averageHash,
            differenceHash,
            perceptualHash,
            colorHistogram
        ] =
            await Promise.all([
                this.createAverageHash(
                    imagePath
                ),
                this.createDifferenceHash(
                    imagePath
                ),
                this.createPerceptualHash(
                    imagePath
                ),
                this.createColorHistogram(
                    imagePath
                )
            ]);

        return {
            averageHash,
            differenceHash,
            perceptualHash,
            colorHistogram
        };
    }


    /**
     * Baut den Index ausschließlich aus
     * bereits vorhandenen Kartenbildern.
     */
    async buildIndex(): Promise<void> {

        console.log('');
        console.log(
            '========================================'
        );

        console.log(
            'ERSTELLE NEUEN MULTI-FEATURE BILDINDEX'
        );

        console.log(
            '========================================'
        );

        console.log('');

        console.log(
            'Lade Kartenliste von TCGdex...'
        );

        const response =
            await fetch(
                'https://api.tcgdex.net/v2/de/cards'
            );

        if (!response.ok) {
            throw new Error(
                `TCGdex Fehler: ${response.status}`
            );
        }

        const cards: TCGdexCard[] =
            await response.json();

        console.log(
            `TCGdex Karten geladen: ${cards.length}`
        );


        const cardsById =
            new Map<
                string,
                TCGdexCard
            >();

        for (const card of cards) {
            cardsById.set(
                card.id,
                card
            );
        }


        console.log(
            'Suche lokale Kartenbilder...'
        );

        const files =
            await fs.readdir(
                this.cacheDirectory
            );

        const imageFiles =
            files.filter(
                file =>
                    file
                        .toLowerCase()
                        .endsWith('.webp')
            );

        console.log(
            `Lokale Bilder gefunden: ${imageFiles.length}`
        );

        console.log('');

        const index: IndexedCard[] = [];

        let processed = 0;
        let skipped = 0;
        let errors = 0;


        for (
            const file of imageFiles
        ) {

            processed++;

            const cardId =
                file.replace(
                    /\.webp$/i,
                    ''
                );

            const card =
                cardsById.get(
                    cardId
                );

            if (!card) {

                skipped++;

                continue;
            }

            const imagePath =
                path.join(
                    this.cacheDirectory,
                    file
                );

            try {

                const features =
                    await this.createFeatures(
                        imagePath
                    );

                index.push({
                    id: card.id,
                    name: card.name,
                    localId: card.localId,
                    image: card.image,
                    set: card.set,
                    features
                });

            } catch {

                errors++;
            }


            if (
                processed === 1 ||
                processed % 100 === 0 ||
                processed === imageFiles.length
            ) {

                console.log(
                    `Verarbeite ${processed}/${imageFiles.length}` +
                    ` | Index: ${index.length}` +
                    ` | Übersprungen: ${skipped}` +
                    ` | Fehler: ${errors}`
                );
            }
        }


        console.log('');
        console.log(
            'Speichere neuen Bildindex...'
        );

        await fs.writeFile(
            this.indexPath,
            JSON.stringify(
                index,
                null,
                2
            ),
            'utf8'
        );

        console.log('');
        console.log(
            '========================================'
        );

        console.log(
            `INDEX ERSTELLT: ${index.length} Karten`
        );

        console.log(
            'Gespeichert unter:'
        );

        console.log(
            this.indexPath
        );

        console.log(
            '========================================'
        );
    }


    private async loadIndex():
        Promise<IndexedCard[]> {

        const content =
            await fs.readFile(
                this.indexPath,
                'utf8'
            );

        return JSON.parse(
            content
        );
    }


    private calculateScore(
        input: ImageFeatures,
        candidate: ImageFeatures
    ) {

        const averageDistance =
            this.calculateNormalizedHashDistance(
                input.averageHash,
                candidate.averageHash
            );

        const differenceDistance =
            this.calculateNormalizedHashDistance(
                input.differenceHash,
                candidate.differenceHash
            );

        const perceptualDistance =
            this.calculateNormalizedHashDistance(
                input.perceptualHash,
                candidate.perceptualHash
            );

        const colorDistance =
            this.calculateColorDistance(
                input.colorHistogram,
                candidate.colorHistogram
            );


        /*
         * Gewichteter Gesamtwert.
         *
         * Niedriger = ähnlicher.
         */
        const score =
            (
                perceptualDistance * 0.40
            ) +
            (
                differenceDistance * 0.30
            ) +
            (
                averageDistance * 0.20
            ) +
            (
                colorDistance * 0.10
            );


        return {
            score,
            averageDistance,
            differenceDistance,
            perceptualDistance,
            colorDistance
        };
    }


    async recognizeCard(
        imagePath: string
    ): Promise<RecognizedCard | null> {

        console.log('');
        console.log(
            'Starte Multi-Feature Bildvergleich...'
        );

        let index: IndexedCard[];

        try {

            index =
                await this.loadIndex();

        } catch {

            console.log(
                'Kein Bildindex gefunden.'
            );

            console.log(
                'Bitte zuerst ausführen:'
            );

            console.log(
                'npm run build-index'
            );

            return null;
        }


        console.log(
            `Lokaler Index geladen: ${index.length} Karten`
        );

        console.log(
            'Erstelle Bildmerkmale...'
        );

        const inputFeatures =
            await this.createFeatures(
                imagePath
            );


        const results:
            SearchResult[] =
            [];


        for (
            const card of index
        ) {

            const comparison =
                this.calculateScore(
                    inputFeatures,
                    card.features
                );

            results.push({
                card,
                ...comparison
            });
        }


        results.sort(
            (a, b) =>
                a.score -
                b.score
        );


        const topResults =
            results.slice(0, 5);


        console.log('');
        console.log(
            '========================================'
        );

        console.log(
            'TOP 5 BILDTREFFER'
        );

        console.log(
            '========================================'
        );


        topResults.forEach(
            (
                result,
                index
            ) => {

                console.log('');

                console.log(
                    `#${index + 1}`
                );

                console.log(
                    `Name: ${result.card.name}`
                );

                console.log(
                    `Kartennummer: ${result.card.localId}`
                );

                console.log(
                    `Set: ${
                        result.card.set?.name ??
                        'Unbekannt'
                    }`
                );

                console.log(
                    `Score: ${result.score.toFixed(4)}`
                );

                console.log(
                    `Average Hash: ${result.averageDistance.toFixed(4)}`
                );

                console.log(
                    `Difference Hash: ${result.differenceDistance.toFixed(4)}`
                );

                console.log(
                    `Perceptual Hash: ${result.perceptualDistance.toFixed(4)}`
                );

                console.log(
                    `Farbe: ${result.colorDistance.toFixed(4)}`
                );
            }
        );


        const best =
            topResults[0];


        if (!best) {

            return null;
        }


        const confidence =
            (
                1 -
                best.score
            ) *
            100;


        const secondBest =
            topResults[1];


        const difference =
            secondBest
                ? secondBest.score -
                  best.score
                : 0;


        console.log('');
        console.log(
            '========================================'
        );

        console.log(
            'BESTER TREFFER'
        );

        console.log(
            '========================================'
        );

        console.log(
            `Name: ${best.card.name}`
        );

        console.log(
            `Score: ${best.score.toFixed(4)}`
        );

        console.log(
            `Confidence: ${confidence.toFixed(1)}%`
        );

        console.log(
            `Abstand zu Platz 2: ${difference.toFixed(4)}`
        );


        /*
         * Noch KEINE harte Schwelle.
         *
         * Wir wollen zunächst die echten
         * Testergebnisse sehen.
         */
        return {
            id: best.card.id,
            name: best.card.name,
            localId: best.card.localId,
            cardNumber: best.card.localId,
            image: best.card.image,
            set: best.card.set
        };
    }
}


export default new CardImageRecognitionService();