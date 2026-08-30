import CardImageRecognitionService from './services/CardImageRecognitionService.ts';

console.log('');
console.log('========================================');
console.log('STARTE AUFBAU DES KARTEN-BILDINDEX');
console.log('========================================');
console.log('');

try {
    await CardImageRecognitionService.buildIndex();

    console.log('');
    console.log('========================================');
    console.log('INDEX AUFBAU ERFOLGREICH ABGESCHLOSSEN');
    console.log('========================================');

} catch (error) {
    console.error('');
    console.error('========================================');
    console.error('FEHLER BEIM INDEX-AUFBAU');
    console.error('========================================');

    console.error(error);

    process.exit(1);
}