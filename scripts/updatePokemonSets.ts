import fs from "node:fs/promises";

const TCGDEX_URL = "https://api.tcgdex.net/v2/ja/sets";
const JP_URL =
  "https://bulbapedia.bulbagarden.net/wiki/List_of_Japanese_TCG_Expansions";
const LANG_URL =
  "https://bulbapedia.bulbagarden.net/wiki/List_of_TCG_expansions_in_other_languages";
const OUTPUT = "data/pokemon-sets.json";
const MIN_DATE = "2019-01-01";

type TcgDexSet = {
  id: string;
  name: string;
  releaseDate?: string;
};

type SetEntry = {
  japanese: string;
  english?: string;
  german?: string;
};

function clean(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function norm(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[•·]/g, "•")
    .replace(/\s+/g, " ")
    .trim();
}

function rows(html: string): string[][] {
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map((m) =>
      [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) =>
        clean(x[1]),
      ),
    )
    .filter((r) => r.length);
}

function tables(html: string): string[][][] {
  return [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) =>
    rows(m[0]),
  );
}

function englishName(value: string): string | undefined {
  let v = clean(value);
  if (!v || /^n\/a$/i.test(v) || v === "—") return undefined;

  v = v
    .replace(/^parts? of /i, "")
    .replace(/^⅓ of /i, "")
    .replace(/^⅔ of /i, "")
    .replace(/^trainer galleries of /i, "")
    .replace(/\.$/, "")
    .trim();

  return v || undefined;
}

function parseJapanese(html: string): Map<string, string> {
  const map = new Map<string, string>();

  for (const table of tables(html)) {
    let header: string[] | undefined;

    for (const row of table) {
      const h = row.map(norm);

      if (
        h.some((x) => x.includes("japanese name")) &&
        h.some((x) => x.includes("english equivalent"))
      ) {
        header = h;
        continue;
      }

      if (!header) continue;

      const jp = header.findIndex((x) => x.includes("japanese name"));
      const en = header.findIndex((x) => x.includes("english equivalent"));

      if (jp < 0 || en < 0 || row.length <= Math.max(jp, en)) continue;

      const japanese = norm(row[jp]);
      const english = englishName(row[en]);

      if (japanese && english) {
        map.set(japanese, english);
      }
    }
  }

  return map;
}

function parseGerman(html: string): Map<string, string> {
  const map = new Map<string, string>();

  for (const table of tables(html)) {
    let header: string[] | undefined;

    for (const row of table) {
      const h = row.map(norm);

      if (
        h.some((x) => x === "english") &&
        h.some((x) => x === "german")
      ) {
        header = h;
        continue;
      }

      if (!header) continue;

      const en = header.findIndex((x) => x === "english");
      const de = header.findIndex((x) => x === "german");

      if (en < 0 || de < 0 || row.length <= Math.max(en, de)) continue;

      const english = norm(row[en]);
      const german = clean(row[de]);

      if (english && german && german !== "—") {
        map.set(english, german);
      }
    }
  }

  return map;
}

function findEnglish(
  japanese: string,
  map: Map<string, string>,
): string | undefined {
  const target = norm(japanese);

  for (const [source, english] of map) {
    if (source === target || source.startsWith(target + " ")) {
      return english;
    }
  }

  for (const [source, english] of map) {
    if (source.includes(target)) {
      return english;
    }
  }

  return undefined;
}

function findGerman(
  english: string | undefined,
  map: Map<string, string>,
): string | undefined {
  if (!english) return undefined;

  const target = norm(english);

  for (const [source, german] of map) {
    if (source === target) return german;
  }

  for (const [source, german] of map) {
    if (source.includes(target) || target.includes(source)) {
      return german;
    }
  }

  return undefined;
}

async function getText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "PokeBay-CLI set-map updater",
    },
  });

  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }

  return response.text();
}

async function main() {
  const [setsResponse, jpHtml, langHtml, oldJson] = await Promise.all([
    fetch(TCGDEX_URL, {
      headers: { "User-Agent": "PokeBay-CLI set-map updater" },
    }),
    getText(JP_URL),
    getText(LANG_URL),
    fs.readFile(OUTPUT, "utf8"),
  ]);

  if (!setsResponse.ok) {
    throw new Error(`TCGDex: HTTP ${setsResponse.status}`);
  }

  const sets = (await setsResponse.json()) as TcgDexSet[];
  const existing = JSON.parse(oldJson) as Record<string, SetEntry>;

  const jpMap = parseJapanese(jpHtml);
  const deMap = parseGerman(langHtml);

  if (jpMap.size < 100) {
    throw new Error(
      `Abbruch: Bulbapedia-JP-Parser lieferte nur ${jpMap.size} Zuordnungen.`,
    );
  }

  if (deMap.size < 100) {
    throw new Error(
      `Abbruch: Bulbapedia-DE-Parser lieferte nur ${deMap.size} Zuordnungen.`,
    );
  }

  const current = sets
    .filter((s) => (s.releaseDate ?? "9999-99-99") >= MIN_DATE)
    .sort((a, b) =>
      (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""),
    );

  const output: Record<string, SetEntry> = { ...existing };
  const unresolved: string[] = [];

  for (const set of current) {
    const english = findEnglish(set.name, jpMap);
    const german = findGerman(english, deMap);

    output[set.id] = {
      japanese: set.name,
      ...(english ? { english } : {}),
      ...(german ? { german } : {}),
    };

    if (!english) {
      unresolved.push(`${set.id} | ${set.name}`);
    } else if (!german) {
      unresolved.push(
        `${set.id} | ${set.name} -> ${english} | DE fehlt`,
      );
    }
  }

  const sv6a = output["SV6a"];

  if (
    !sv6a ||
    sv6a.english !== "Shrouded Fable" ||
    sv6a.german !== "Nebel der Sagen"
  ) {
    throw new Error(
      `SV6a-Sicherheitsprüfung fehlgeschlagen: ${JSON.stringify(sv6a)}`,
    );
  }

  const ratio = unresolved.length / Math.max(current.length, 1);

  if (ratio > 0.35) {
    console.error(unresolved.join("\n"));
    throw new Error(
      `Abbruch: ${unresolved.length}/${current.length} Sets konnten nicht sauber zugeordnet werden.`,
    );
  }

  await fs.writeFile(
    OUTPUT,
    JSON.stringify(output, null, 2) + "\n",
    "utf8",
  );

  console.log(`OK: ${current.length} japanische Sets ab ${MIN_DATE}`);
  console.log(`Sonderfälle/fehlende Zuordnung: ${unresolved.length}`);
  console.log(
    `SV6a: ${sv6a.japanese} -> ${sv6a.english} -> ${sv6a.german}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
