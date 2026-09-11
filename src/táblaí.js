'use strict';

// táblaí.js — clárlann na dtáblaí stóir (§7.6).
//
// Vocabulary and engineering, not grammar (same status as contaetha.js and
// `Iasacht`). `faigh X as Y` is ordinary Irish, but "a category may have a
// table behind it" is not a grammatical phenomenon and never claimed to be.
//
// Three jobs:
//  1. Table name, derived from the type name and nothing else.
//  2. Registry: which table a type reads from and what columns it has.
//  3. The ceiling — stated out loud, because it's smaller than it looks.
//
// ── Pluralisation ──
// `duine` -> `daoine` is suppletive and no rule reaches it (the same finding
// §5.10 made about gender: ending rules say nothing about the vowel-final
// fifth of nouns, and are actively wrong for `duine`). So the table name is
// just the type's lemma, lowercased, singular — no inference attempted.
//
// ── The ceiling ──
// 32, and a table claims a county rather than a province. Two registries at
// two granularities, and they collide:
//
//   an ordinary placed type   claims a PROVINCE   — 4 slots
//   a `stór` type             claims a COUNTY     — 32 slots
//
// A table in Corcaigh blocks any ordinary type claiming An Mhumhain, and vice
// versa — the marker is not an escape hatch from E603. 32 is reachable only
// by a program with no ordinary placed types at all.
//
// This also means the rivalry table now bites on the reading side too: two
// tables can sit in rival counties, and then no file can read both, since no
// treaty between rivals can exist.

/**
 * Ceiling on tables in a compiled graph: one per county (E610), one table per
 * county (E612), so it equals the county count. Asserted against
 * `CONTAETHA.size` in test/stór.js.
 */
const UASMHEID = 32;

/** The table a type reads from: lowercased lemma, nothing else. */
function ainmTabla(ainmCineail) {
  return ainmCineail.toLowerCase();
}

/**
 * The tables visible from one module: local declarations plus everything an
 * import brought with it. A view, not a source of truth — `cineal.stor` on
 * the type record is authoritative and crosses module boundaries with it.
 * `--graf` and the ceiling read this; the type checker does not.
 */
class ClarlannTablai {
  constructor() {
    // ainm an chineáil → { cineál, tábla, contae, réimsí, ionad }
    this.taifid = new Map();
  }

  /**
   * Register a `stór` type. No collision check here: `Anailiseoir.eiligh`
   * already judged placement by the time this runs.
   */
  cuir(cineal, contae, reimsi, ionad) {
    const taifead = {
      cineal: cineal,
      tabla: ainmTabla(cineal),
      contae,
      reimsi: reimsi.slice(),
      ionad,
    };
    this.taifid.set(cineal, taifead);
    return taifead;
  }

  /** The record for a type name, or null (the E611 case). */
  faigh(cineal) {
    return this.taifid.get(cineal) || null;
  }

  ann(cineal) {
    return this.taifid.has(cineal);
  }

  /** Every table, in declaration order, for `--paraidím` and `--graf`. */
  gach() {
    return [...this.taifid.values()];
  }

  get lion() {
    return this.taifid.size;
  }
}

module.exports = { UASMHEID, ainmTabla, ClarlannTablai };