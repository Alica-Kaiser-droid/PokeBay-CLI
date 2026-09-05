import fs from "node:fs/promises";

const BASE_URL = "https://api.tcgdex.net/v2";
const OUTPUT = "data/pokemon-sets.json";

interface SetEntry {
  japanese: string;
  english?: string;
  german?: string;
}

async function fetchSets(language: string): Promise<any[]> {
  const response = await fetch(`${BASE_URL}/${language}/sets`);
  if (!response.ok) throw new Error(`TCGDex ${language}: HTTP ${response.status}`);
  return response.json();
}

async function main() {
  const japaneseSets = await fetchSets("ja");
  let existing: Record<string, SetEntry> = {};

  try {
    existing = JSON.parse(await fs.readFile(OUTPUT, "utf8"));
  } catch {
    console.log("Keine vorhandene Set-Datei gefunden.");
  }

  for (const set of japaneseSets) {
    if (!set.id || !set.name) continue;

    existing[set.id] = {
      ...existing[set.id],
      japanese: set.name,
    };
  }

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(
    OUTPUT,
    JSON.stringify(existing, null, 2) + "\n",
    "utf8"
  );

  console.log(`Gespeichert: ${Object.keys(existing).length} Sets`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
