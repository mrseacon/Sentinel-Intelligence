/**
 * Vollständigkeits-Test (I18N_DECISIONS.md §3): liest die tatsächlichen
 * Backend-Quelldateien ein (kein zweiter, von Hand gepflegter Duplikat-
 * Codeliste) und prüft, dass JEDER Code, den `errors.py`/`main.py`
 * zurückgeben können, einen englischen Eintrag in `ERROR_MESSAGES_EN`
 * hat. Ein neuer Backend-Fehlercode (wie zuletzt CORRELATION_INVALID_INPUT)
 * lässt diesen Test rot werden, bis die Übersetzung nachgezogen ist.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ERROR_MESSAGES_EN } from "./error-messages.en";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendApiDir = path.resolve(here, "../../../backend/src/sentinel_api");

/** Jedes literale `"code": "X"` in einer Datei — deckt die drei
 * Handler-Codes in errors.py (VALIDATION_ERROR/INTERNAL_ERROR/
 * UPSTREAM_UNAVAILABLE) und PAYLOAD_TOO_LARGE in main.py ab. Der
 * dynamische Fall `"code": error_code_for(message)` matcht bewusst
 * nicht (kein String-Literal) — dessen mögliche Werte kommen aus der
 * Registry, s. extractRegistryCodes(). */
function extractLiteralCodes(filePath: string): string[] {
  const text = readFileSync(filePath, "utf-8");
  return [...text.matchAll(/"code":\s*"([A-Z_]+)"/g)].map((m) => m[1]);
}

function extractRegistryCodes(errorsPyPath: string): string[] {
  const text = readFileSync(errorsPyPath, "utf-8");

  const registryMatch = text.match(/ERROR_CODE_REGISTRY[^(]*=\s*\(([\s\S]*?)\n\)/);
  if (!registryMatch) {
    throw new Error(
      "ERROR_CODE_REGISTRY not found in errors.py in the expected shape — " +
        "has the tuple-of-tuples format changed? Update this parser.",
    );
  }
  const tupleCodes = [
    ...registryMatch[1].matchAll(/\(\s*"[^"]*",\s*"([A-Z_]+)"\s*\)/g),
  ].map((m) => m[1]);

  const fallbackMatch = text.match(/FALLBACK_CODE\s*=\s*"([A-Z_]+)"/);
  if (!fallbackMatch) {
    throw new Error("FALLBACK_CODE not found in errors.py — update this parser.");
  }

  return [...tupleCodes, fallbackMatch[1]];
}

describe("English error message completeness vs. backend errors.py", () => {
  it("has an entry for every code the backend can actually return", () => {
    const errorsPyPath = path.join(backendApiDir, "errors.py");
    const mainPyPath = path.join(backendApiDir, "main.py");

    const backendCodes = new Set([
      ...extractRegistryCodes(errorsPyPath),
      ...extractLiteralCodes(errorsPyPath),
      ...extractLiteralCodes(mainPyPath),
    ]);

    // Sanity check on the parser itself: if this ever drops to a
    // suspiciously small number, the regexes above stopped matching
    // (e.g. backend file moved/reformatted) rather than the backend
    // genuinely having fewer codes — fail loudly instead of passing
    // trivially on an empty set.
    expect(backendCodes.size).toBeGreaterThanOrEqual(15);

    const frontendCodes = new Set(Object.keys(ERROR_MESSAGES_EN));
    const missing = [...backendCodes].filter((code) => !frontendCodes.has(code));

    expect(
      missing,
      `Backend error code(s) without an English translation in error-messages.en.ts: ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
