import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface OcrText {
    text: string;
    confidence: number;
}

export interface CardOcrResult {
    texts: OcrText[];
    possibleCardNumbers: string[];
    possibleNames: string[];
}

interface PythonOcrResponse {
    success: boolean;
    texts?: OcrText[];
    error?: string;
}

export class CardOcrService {
    private readonly projectRoot: string;
    private readonly pythonPath: string;
    private readonly scriptPath: string;

    constructor() {
        this.projectRoot = process.cwd();

        this.pythonPath = path.resolve(
            this.projectRoot,
            ".venv",
            "bin",
            "python"
        );

        this.scriptPath = path.resolve(
            this.projectRoot,
            "scripts",
            "card_ocr.py"
        );
    }

    public async processImage(
        imagePath: string
    ): Promise<CardOcrResult> {
        return this.recognizeText(imagePath);
    }

    public async recognizeText(
        imagePath: string
    ): Promise<CardOcrResult> {
        if (!fs.existsSync(imagePath)) {
            throw new Error(
                `Bilddatei nicht gefunden: ${imagePath}`
            );
        }

        if (!fs.existsSync(this.pythonPath)) {
            throw new Error(
                `Python Virtual Environment nicht gefunden: ${this.pythonPath}`
            );
        }

        if (!fs.existsSync(this.scriptPath)) {
            throw new Error(
                `OCR Script nicht gefunden: ${this.scriptPath}`
            );
        }

        console.log("");
        console.log("Starte lokale PaddleOCR-Erkennung...");
        console.log(`Python: ${this.pythonPath}`);
        console.log(`OCR Script: ${this.scriptPath}`);

        const response = await this.runPythonOcr(imagePath);

        if (!response.success) {
            throw new Error(
                response.error ?? "Unbekannter OCR-Fehler."
            );
        }

        const texts = Array.isArray(response.texts)
            ? response.texts
            : [];

        const possibleCardNumbers =
            this.findPossibleCardNumbers(texts);

        const possibleNames =
            this.findPossibleNames(texts);

        console.log(
            `OCR-Texte erkannt: ${texts.length}`
        );

        console.log(
            `Mögliche Kartennummern: ${
                possibleCardNumbers.length > 0
                    ? possibleCardNumbers.join(", ")
                    : "keine"
            }`
        );

        console.log(
            `Mögliche Namen: ${
                possibleNames.length > 0
                    ? possibleNames.join(", ")
                    : "keine"
            }`
        );

        return {
            texts,
            possibleCardNumbers,
            possibleNames
        };
    }

    private runPythonOcr(
        imagePath: string
    ): Promise<PythonOcrResponse> {
        return new Promise((resolve, reject) => {
            console.log(
                "Starte Python OCR-Prozess..."
            );

            const child = spawn(
                this.pythonPath,
                [
                    this.scriptPath,
                    imagePath
                ],
                {
                    cwd: this.projectRoot,

                    env: {
                        ...process.env,

                        OMP_NUM_THREADS: "1",
                        MKL_NUM_THREADS: "1",
                        OPENBLAS_NUM_THREADS: "1",
                        NUMEXPR_NUM_THREADS: "1",
                        FLAGS_use_mkldnn: "0"
                    },

                    stdio: [
                        "ignore",
                        "pipe",
                        "pipe"
                    ]
                }
            );

            let stdout = "";
            let stderr = "";

            child.stdout.on(
                "data",
                (data: Buffer) => {
                    stdout += data.toString();
                }
            );

            child.stderr.on(
                "data",
                (data: Buffer) => {
                    stderr += data.toString();
                }
            );

            child.once(
                "error",
                (error) => {
                    reject(
                        new Error(
                            "OCR-Prozess konnte nicht gestartet werden: " +
                            error.message
                        )
                    );
                }
            );

            child.once(
                "close",
                (code, signal) => {
                    console.log(
                        `Python OCR beendet. Exit Code: ${code}, Signal: ${signal}`
                    );

                    const cleanedStdout =
                        stdout.trim();

                    if (!cleanedStdout) {
                        reject(
                            new Error(
                                [
                                    "OCR hat keine Antwort geliefert.",
                                    "",
                                    `Exit Code: ${code}`,
                                    `Signal: ${signal}`,
                                    "",
                                    "STDERR:",
                                    stderr
                                ].join("\n")
                            )
                        );

                        return;
                    }

                    let response: PythonOcrResponse;

                    try {
                        response = JSON.parse(
                            cleanedStdout
                        );
                    } catch {
                        reject(
                            new Error(
                                [
                                    "OCR hat keine gültige JSON-Antwort geliefert.",
                                    "",
                                    `Exit Code: ${code}`,
                                    `Signal: ${signal}`,
                                    "",
                                    "STDOUT:",
                                    stdout,
                                    "",
                                    "STDERR:",
                                    stderr
                                ].join("\n")
                            )
                        );

                        return;
                    }

                    if (!response.success) {
                        reject(
                            new Error(
                                response.error ??
                                [
                                    "OCR-Prozess fehlgeschlagen.",
                                    "",
                                    `Exit Code: ${code}`,
                                    `Signal: ${signal}`,
                                    "",
                                    "STDERR:",
                                    stderr
                                ].join("\n")
                            )
                        );

                        return;
                    }

                    resolve(response);
                }
            );
        });
    }

    private findPossibleCardNumbers(
        texts: OcrText[]
    ): string[] {
        const numbers = new Set<string>();

        for (const item of texts) {
            const text = item.text
                .replace(/\s+/g, "");

            const matches = text.matchAll(
                /(\d{1,3})\/(\d{2,3})/g
            );

            for (const match of matches) {
                const left = Number(match[1]);
                const right = Number(match[2]);

                if (
                    !Number.isFinite(left) ||
                    !Number.isFinite(right)
                ) {
                    continue;
                }

                if (
                    left <= 0 ||
                    right <= 0 ||
                    left > 999 ||
                    right > 999
                ) {
                    continue;
                }

                numbers.add(
                    `${left}/${right}`
                );
            }
        }

        return Array.from(numbers).sort(
            (a, b) => {
                const [aLeft, aRight] =
                    a.split("/").map(Number);

                const [bLeft, bRight] =
                    b.split("/").map(Number);

                if (aRight !== bRight) {
                    return aRight - bRight;
                }

                return aLeft - bLeft;
            }
        );
    }

    private normalizeText(
        text: string
    ): string {
        return text
            .toLowerCase()
            .replace(
                /[^a-zäöüßà-ÿ ]/gi,
                " "
            )
            .replace(/\s+/g, " ")
            .trim();
    }

    private looksLikeSentence(
        text: string
    ): boolean {
        const normalized =
            this.normalizeText(text);

        const words = normalized
            .split(/\s+/)
            .filter(Boolean);

        if (words.length >= 4) {
            return true;
        }

        const sentencePatterns = [
            /^entwickelt sich aus\b/i,
            /^fntwickelt sich aus\b/i,
            /^wenn dieses\b/i,
            /^diese attacke\b/i,
            /^du kannst\b/i,
            /^lege \d+\b/i,
            /^durch schaden\b/i,
            /^sehr selten\b/i,
            /^ein hitziger\b/i,
            /^man sagt\b/i,
            /^mansagt\b/i,
            /^nr\b/i,
            /^illustr\b/i,
            /^llustr\b/i,
            /^ilustr\b/i
        ];

        return sentencePatterns.some(
            pattern => pattern.test(normalized)
        );
    }

    private isBlockedCardText(
        normalized: string
    ): boolean {
        const blockedWords = new Set([
            "basis",
            "phase",
            "phase1",
            "phase2",
            "resistenz",
            "schwache",
            "schwäche",
            "ruckzug",
            "rückzug",
            "pokemon",
            "pokémon",
            "illustr",
            "illustrator",
            "illust",
            "lustr",
            "copyright",
            "fahigkeit",
            "fähigkeit",
            "kp",
            "hp"
        ]);

        if (blockedWords.has(normalized)) {
            return true;
        }

        if (
            /^(schwache|schwäche|resistenz|ruckzug|rückzug)[x\d]*$/i
                .test(normalized)
        ) {
            return true;
        }

        return false;
    }

    private isMetadataText(
        text: string
    ): boolean {
        return /(?:nintendo|creatures|game\s*freak|pokemon\/nintendo|pokémon\/nintendo|©|20\d{2})/i.test(
            text
        );
    }

    private scoreNameCandidate(
        item: OcrText,
        index: number,
        totalTexts: number
    ): number {
        const text = item.text.trim();

        const normalized =
            this.normalizeText(text);

        const words = normalized
            .split(/\s+/)
            .filter(Boolean);

        let score =
            item.confidence * 100;

        if (index <= 5) {
            score += 35;
        } else if (index <= 10) {
            score += 15;
        }

        if (words.length === 1) {
            score += 35;
        } else if (words.length === 2) {
            score += 10;
        }

        if (
            text.length >= 4 &&
            text.length <= 20
        ) {
            score += 15;
        }

        if (/^[A-ZÄÖÜ]/.test(text)) {
            score += 10;
        }

        if (
            text === text.toUpperCase() &&
            text.length > 3
        ) {
            score -= 10;
        }

        if (text.length > 20) {
            score -= 25;
        }

        if (index > totalTexts * 0.65) {
            score -= 15;
        }

        return score;
    }

    private findPossibleNames(
        texts: OcrText[]
    ): string[] {
        const candidates: Array<{
            text: string;
            confidence: number;
            score: number;
        }> = [];

        const knownNonNameWords = new Set([
            "springflut",
            "wellenwirbel",
            "peitschenschlag",
            "ruckkehr",
            "rückkehr",
            "qualmwirbel"
        ]);

        for (
            let index = 0;
            index < texts.length;
            index++
        ) {
            const item = texts[index];
            const text = item.text.trim();

            if (!text) {
                continue;
            }

            if (item.confidence < 0.85) {
                continue;
            }

            if (
                text.length < 3 ||
                /^[^a-zA-ZÀ-ÿ]+$/.test(text)
            ) {
                continue;
            }

            if (/\d/.test(text)) {
                continue;
            }

            if (this.isMetadataText(text)) {
                continue;
            }

            if (
                /illustr|illust|lustr\.|ilustr/i
                    .test(text)
            ) {
                continue;
            }

            const normalized =
                this.normalizeText(text);

            if (!normalized) {
                continue;
            }

            if (
                this.isBlockedCardText(normalized)
            ) {
                continue;
            }

            if (
                knownNonNameWords.has(normalized)
            ) {
                continue;
            }

            if (
                this.looksLikeSentence(text)
            ) {
                continue;
            }

            const words = normalized
                .split(/\s+/)
                .filter(Boolean);

            if (words.length > 2) {
                continue;
            }

            const lettersOnly =
                text.replace(
                    /[^a-zA-ZÄÖÜäöüßÀ-ÿ]/g,
                    ""
                );

            if (lettersOnly.length < 3) {
                continue;
            }

            candidates.push({
                text,
                confidence: item.confidence,
                score: this.scoreNameCandidate(
                    item,
                    index,
                    texts.length
                )
            });
        }

        candidates.sort(
            (a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }

                return (
                    b.confidence -
                    a.confidence
                );
            }
        );

        const unique = new Set<string>();
        const result: string[] = [];

        for (const candidate of candidates) {
            const key =
                this.normalizeText(
                    candidate.text
                );

            if (unique.has(key)) {
                continue;
            }

            unique.add(key);
            result.push(candidate.text);

            if (result.length >= 3) {
                break;
            }
        }

        return result;
    }
}

export default CardOcrService;