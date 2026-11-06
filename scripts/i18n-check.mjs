import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = "en";
const TARGETS = ["es", "fr"];
const REVIEW_FLAG = "_reviewed";
const checkReviewed = process.argv.includes("--reviewed");

const load = (locale) =>
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "messages", `${locale}.json`), "utf8"));

const flatten = (obj, prefix = "") =>
  Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === "object" ? flatten(value, path) : [[path, value]];
  });

const sourceKeys = new Set(flatten(load(SOURCE)).map(([key]) => key));
let failed = false;

for (const locale of TARGETS) {
  const entries = flatten(load(locale));
  const keys = new Set(entries.map(([key]) => key));
  const missing = [...sourceKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !sourceKeys.has(key));

  if (missing.length) {
    failed = true;
    console.error(
      `✗ ${locale}.json is missing ${missing.length} key(s):\n  ${missing.join("\n  ")}`,
    );
  }
  if (extra.length) {
    console.warn(
      `! ${locale}.json has ${extra.length} key(s) not in ${SOURCE}.json:\n  ${extra.join("\n  ")}`,
    );
  }

  if (checkReviewed) {
    const unreviewed = entries
      .filter(([key, value]) => key.endsWith(`.${REVIEW_FLAG}`) && value !== true)
      .map(([key]) => key.slice(0, -REVIEW_FLAG.length - 1));
    if (unreviewed.length) {
      failed = true;
      console.error(`✗ ${locale}.json has unreviewed namespaces:\n  ${unreviewed.join("\n  ")}`);
    }
  }

  if (!missing.length) console.log(`✓ ${locale}.json has every key in ${SOURCE}.json`);
}

process.exit(failed ? 1 : 0);
