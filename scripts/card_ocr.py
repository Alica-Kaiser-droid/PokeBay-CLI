#!/usr/bin/env python3

import sys
import json
import os

# ==================================================
# UMGEBUNGSVARIABLEN
# Müssen VOR dem Import von Paddle gesetzt werden.
# ==================================================

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"

# oneDNN / MKLDNN deaktivieren
os.environ["FLAGS_use_mkldnn"] = "0"

import cv2
import numpy as np
from paddleocr import PaddleOCR


# ==================================================
# KONFIGURATION
# ==================================================

# Wichtig:
# Bei 640x640 hat dein manueller Test funktioniert.
MAX_IMAGE_SIZE = 640

IMAGE_EXTENSIONS = (
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
)


# ==================================================
# LOGGING
# ==================================================

def log(message):
    """
    Debug-Ausgaben ausschließlich nach STDERR.

    STDOUT darf nur JSON enthalten, da Node.js
    die Ausgabe als JSON verarbeitet.
    """
    print(message, file=sys.stderr, flush=True)


# ==================================================
# BILD VERKLEINERN
# ==================================================

def resize_image(image, max_size=MAX_IMAGE_SIZE):
    """
    Verkleinert das Bild proportional.

    Die längste Seite wird maximal max_size groß.
    """

    height, width = image.shape[:2]

    log(f"Originalgröße: {width}x{height}")

    longest_side = max(width, height)

    if longest_side <= max_size:
        log("Bild muss nicht verkleinert werden.")
        return image

    scale = max_size / longest_side

    new_width = max(1, int(width * scale))
    new_height = max(1, int(height * scale))

    resized = cv2.resize(
        image,
        (new_width, new_height),
        interpolation=cv2.INTER_AREA
    )

    log(f"Verkleinert auf: {new_width}x{new_height}")

    return resized


# ==================================================
# TEXT BEREINIGEN
# ==================================================

def clean_text(text):
    """
    Entfernt überflüssige Leerzeichen.
    """

    if not isinstance(text, str):
        return ""

    return " ".join(text.split()).strip()


# ==================================================
# OCR ERGEBNIS EXTRAHIEREN
# ==================================================

def extract_ocr_results(result):
    """
    Unterstützt das klassische PaddleOCR-Rückgabeformat:

    [
        [
            [box, [text, confidence]],
            ...
        ]
    ]
    """

    texts = []

    if not result:
        return texts

    for page in result:

        if not page:
            continue

        for line in page:

            if not line:
                continue

            try:
                text_data = line[1]

                text = clean_text(text_data[0])
                confidence = float(text_data[1])

                if not text:
                    continue

                texts.append({
                    "text": text,
                    "confidence": confidence
                })

            except (
                IndexError,
                TypeError,
                ValueError,
                KeyError
            ):
                continue

    return texts


# ==================================================
# HAUPTPROGRAMM
# ==================================================

def main():

    # ------------------------------------------------
    # ARGUMENT PRÜFEN
    # ------------------------------------------------

    if len(sys.argv) < 2:
        raise RuntimeError(
            "Kein Bild angegeben. "
            "Verwendung: python card_ocr.py <bild>"
        )

    image_path = sys.argv[1]

    # ------------------------------------------------
    # DATEI PRÜFEN
    # ------------------------------------------------

    if not os.path.isfile(image_path):
        raise RuntimeError(
            f"Bilddatei nicht gefunden: {image_path}"
        )

    extension = os.path.splitext(image_path)[1].lower()

    if extension not in IMAGE_EXTENSIONS:
        raise RuntimeError(
            f"Nicht unterstütztes Bildformat: {extension}"
        )

    log(f"Analysiere Bild: {image_path}")

    # ------------------------------------------------
    # BILD LADEN
    # ------------------------------------------------

    image = cv2.imread(image_path)

    if image is None:
        raise RuntimeError(
            "Bild konnte nicht geladen werden."
        )

    # ------------------------------------------------
    # BILD VERKLEINERN
    # ------------------------------------------------

    image = resize_image(image)

    # PaddleOCR bekommt ein zusammenhängendes NumPy Array
    image = np.ascontiguousarray(image)

    log(f"NumPy-Format: {image.shape}")

    # ------------------------------------------------
    # PADDLEOCR INITIALISIEREN
    # ------------------------------------------------

    log("Initialisiere PaddleOCR...")

    ocr = PaddleOCR(
        lang="en",

        # CPU verwenden
        use_gpu=False,

        # Keine unnötigen Zusatzmodelle
        use_angle_cls=False,

        det=True,
        rec=True,

        # Zusätzliche Dokument-Features deaktivieren
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,

        # oneDNN deaktivieren
        enable_mkldnn=False,

        # Nur ein CPU-Thread
        cpu_threads=1,

        # Keine Paddle Debug-Ausgaben
        show_log=False
    )

    log("PaddleOCR erfolgreich initialisiert.")

    # ------------------------------------------------
    # NUR EIN OCR-DURCHLAUF
    #
    # Sehr wichtig:
    # Keine zusätzlichen Bereiche,
    # keine zweite OCR-Ausführung,
    # keine parallelen Prozesse.
    # ------------------------------------------------

    log("Starte OCR...")

    result = ocr.ocr(
        image,
        cls=False
    )

    log("OCR erfolgreich beendet!")

    # ------------------------------------------------
    # ERGEBNIS EXTRAHIEREN
    # ------------------------------------------------

    texts = extract_ocr_results(result)

    # ------------------------------------------------
    # JSON AUSGABE
    # ------------------------------------------------

    output = {
        "success": True,
        "texts": texts
    }

    print(
        json.dumps(
            output,
            ensure_ascii=False
        ),
        flush=True
    )


# ==================================================
# FEHLERBEHANDLUNG
# ==================================================

if __name__ == "__main__":

    try:

        main()

    except Exception as error:

        log(f"OCR FEHLER: {error}")

        error_output = {
            "success": False,
            "error": str(error)
        }

        print(
            json.dumps(
                error_output,
                ensure_ascii=False
            ),
            flush=True
        )

        sys.exit(1)