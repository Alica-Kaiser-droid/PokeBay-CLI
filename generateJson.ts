import fs from 'node:fs/promises';
import path from 'node:path';
import CardRecognitionService from './services/CardRecognitionService';

type Card = {
  name: string;
  number: string;
  set: string;
  language: string;
  images: string[];
  isGraded: boolean;
  startPrice: number;
  condition: string;
};

const imagesDirectory = './images';
const outputFile = './items.json';

async function main() {
  const files = await fs.readdir(
    imagesDirectory
  );

  const imageFiles = files.filter((file) => {
    const extension =
      path.extname(file).toLowerCase();

    return [
      '.jpg',
      '.jpeg',
      '.png'
    ].includes(extension);
  });

  const cards: Card[] = [];

  console.log(
    `${imageFiles.length} Bilder gefunden.`
  );

  for (const imageFile of imageFiles) {
    const imagePath = path.join(
      imagesDirectory,
      imageFile
    );

    console.log(
      `\nAnalysiere: ${imageFile}`
    );

    const recognizedCard =
      await CardRecognitionService.recognizeCard(
        imagePath
      );

    cards.push({
      name:
        recognizedCard?.name ??
        path.parse(imageFile).name,

      number:
        recognizedCard?.cardNumber ?? '',

      set:
        recognizedCard?.set?.name ?? '',

      language: 'Deutsch',

      images: [
        imageFile
      ],

      isGraded: false,

      startPrice: 1,

      condition: 'Ungraded'
    });
  }

  await fs.writeFile(
    outputFile,
    JSON.stringify(cards, null, 2),
    'utf-8'
  );

  console.log(
    `\n${cards.length} Karten in ${outputFile} erstellt.`
  );
}

main().catch((error) => {
  console.error(
    'Fehler beim Generieren:',
    error
  );
});