import fs from 'node:fs/promises';
import path from 'node:path';

import CardImageRecognitionService from './services/CardImageRecognitionService';

type TcgDexCard = {
    id: string;
    name: string;
    localId: string;
    image?: string;
    set: {
        id: string;
        name: string;
    };
};

type CardImageIndexEntry = {
    id: string;
    name: string;
    localId: string;
    set: {
        id: string;
        name: string;
    };
    image: string;
    fingerprint: string;
};

type CardImageIndex = {
    updatedAt: string;
    cards: CardImageIndexEntry[];
};

async function main() {
    console.log('');
    console.log(
        '========================================'
    );
    console.log(
        'STARTE AKTUALISIERUNG DES BILDINDEX'
    );
    console.log(
        '========================================'
    );
    console.log('');

    const cacheDir = path.join(
        process.cwd(),
        'cache'
    );

    const indexPath = path.join(
        cacheDir,
        'card-image-index.json'
    );

    await fs.mkdir(
        cacheDir,
        {
            recursive: true
        }
    );

    /*
     * Bestehenden Index laden
     */

    let currentIndex: CardImageIndex = {
        updatedAt: '',
        cards: []
    };

    try {
        const existingContent =
            await fs.readFile(
                indexPath,
                'utf8'
            );

        currentIndex =
            JSON.parse(
                existingContent
            );

        console.log(
            `Bestehender Index: ${currentIndex.cards.length} Karten`
        );

    } catch {
        console.log(
            'Kein bestehender Index gefunden.'
        );

        console.log(
            'Es wird ein neuer Index erstellt.'
        );
    }

    /*
     * Bereits vorhandene Karten-IDs speichern
     */

    const existingIds =
        new Set(
            currentIndex.cards.map(
                card => card.id
            )
        );

    /*
     * TCGdex laden
     */

    console.log(
        'Lade aktuelle Kartenliste von TCGdex...'
    );

    const response = await fetch(
        'https://api.tcgdex.net/v2/de/cards'
    );

    if (!response.ok) {
        throw new Error(
            `TCGdex API Fehler: ${response.status}`
        );
    }

    const allCards =
        await response.json() as TcgDexCard[];

    console.log(
        `TCGdex enthält aktuell: ${allCards.length} Karten`
    );

    /*
     * Nur neue Karten auswählen
     */

    const newCards =
        allCards.filter(
            card =>
                !existingIds.has(card.id) &&
                card.image &&
                card.name &&
                card.localId
        );

    console.log(
        `Neue Karten gefunden: ${newCards.length}`
    );

    if (
        newCards.length === 0
    ) {
        console.log('');
        console.log(
            'Keine neuen Karten vorhanden.'
        );

        currentIndex.updatedAt =
            new Date().toISOString();

        await fs.writeFile(
            indexPath,
            JSON.stringify(
                currentIndex,
                null,
                2
            ),
            'utf8'
        );

        return;
    }

    /*
     * Neue Karten verarbeiten
     */

    let processed = 0;
    let added = 0;

    for (const card of newCards) {
        processed++;

        try {
            console.log(
                `[${processed}/${newCards.length}] ${card.name}`
            );

            const imageUrl =
                `${card.image}/high.png`;

            const imageResponse =
                await fetch(imageUrl);

            if (!imageResponse.ok) {
                console.log(
                    '  Kartenbild konnte nicht geladen werden.'
                );

                continue;
            }

            const imageBuffer =
                Buffer.from(
                    await imageResponse.arrayBuffer()
                );

            const tempImagePath =
                path.join(
                    cacheDir,
                    `temp-update-${card.id}.png`
                );

            await fs.writeFile(
                tempImagePath,
                imageBuffer
            );

            const fingerprint =
                await CardImageRecognitionService.createFingerprint(
                    tempImagePath
                );

            await fs.unlink(
                tempImagePath
            );

            currentIndex.cards.push({
                id: card.id,
                name: card.name,
                localId: card.localId,
                set: {
                    id: card.set.id,
                    name: card.set.name
                },
                image: card.image!,
                fingerprint
            });

            added++;

            console.log(
                `  ✓ Hinzugefügt`
            );

        } catch (error) {
            console.log(
                `  Fehler bei ${card.name}:`,
                error
            );
        }
    }

    /*
     * Index speichern
     */

    currentIndex.updatedAt =
        new Date().toISOString();

    await fs.writeFile(
        indexPath,
        JSON.stringify(
            currentIndex,
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
        'AKTUALISIERUNG ABGESCHLOSSEN'
    );
    console.log(
        `Neue Karten hinzugefügt: ${added}`
    );
    console.log(
        `Gesamtzahl im Index: ${currentIndex.cards.length}`
    );
    console.log(
        `Gespeichert unter: ${indexPath}`
    );
    console.log(
        '========================================'
    );
}

main().catch(
    error => {
        console.error(
            'Fehler beim Aktualisieren:',
            error
        );

        process.exit(1);
    }
);