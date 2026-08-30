import * as path from "node:path";
import * as fs from "node:fs";

import FormData from "form-data";
import fetch from "node-fetch";

import OsService from "#services/OsService";

class ImageUploadService {
    private static readonly IMGBB_API_URL =
        "https://api.imgbb.com/1/upload";

    /**
     * Ein einzelnes Bild hochladen.
     */
    static async uploadImage(
        imageName: string
    ): Promise<string> {
        const apiKey =
            process.env.IMGBB_API_KEY;

        if (!apiKey) {
            throw new Error(
                "IMGBB_API_KEY fehlt. Bitte überprüfe deine .env-Datei."
            );
        }

        if (
            !imageName ||
            typeof imageName !== "string"
        ) {
            throw new Error(
                `Ungültiger Bildname: ${String(imageName)}`
            );
        }

        const imagePath = path.join(
            OsService.getDirname(),
            "../images",
            imageName
        );

        if (!fs.existsSync(imagePath)) {
            throw new Error(
                `Bilddatei nicht gefunden: ${imagePath}`
            );
        }

        console.log(
            `Lade Bild hoch: ${imagePath}`
        );

        const formData =
            new FormData();

        formData.append(
            "image",
            fs.createReadStream(imagePath)
        );

        const response = await fetch(
            `${this.IMGBB_API_URL}?key=${apiKey}`,
            {
                method: "POST",

                body: formData
            }
        );

        const responseText =
            await response.text();

        console.log(
            "ImgBB Status:",
            response.status
        );

        console.log(
            "ImgBB Antwort:",
            responseText
        );

        if (!response.ok) {
            throw new Error(
                `ImgBB HTTP Fehler ${response.status}: ${responseText}`
            );
        }

        if (!responseText) {
            throw new Error(
                "ImgBB hat eine leere Antwort zurückgegeben."
            );
        }

        let data: any;

        try {
            data =
                JSON.parse(responseText);
        } catch {
            throw new Error(
                `ImgBB hat keine gültige JSON-Antwort geliefert: ${responseText}`
            );
        }

        if (
            data.success &&
            data.data?.url
        ) {
            console.log(
                "Bild erfolgreich hochgeladen:",
                data.data.url
            );

            return data.data.url;
        }

        throw new Error(
            `ImgBB Upload fehlgeschlagen: ${JSON.stringify(data)}`
        );
    }

    /**
     * Mehrere Bilder hochladen.
     */
    static async uploadMultipleImages(
        imageNames: string[]
    ): Promise<string[]> {
        if (
            !Array.isArray(imageNames) ||
            imageNames.length === 0
        ) {
            throw new Error(
                "Es wurden keine Bilder zum Hochladen übergeben."
            );
        }

        const imageUrls: string[] = [];

        for (const imageName of imageNames) {
            const imageUrl =
                await this.uploadImage(imageName);

            imageUrls.push(imageUrl);
        }

        return imageUrls;
    }
}

export default ImageUploadService;