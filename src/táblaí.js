'use strict';

/*
 * táblaí.js — clárlann na dtáblaí stóir (§7.6).
 *
 * Vocabulary and engineering, not grammar. Same status as `contaetha.js` and
 * `Iasacht`, and it is written here for the same reason: so that nobody later
 * mistakes it for something that came out of the language.
 *
 * `stór` is an ordinary Irish noun and `faigh X as Y` is ordinary Irish — `as`
 * is the preposition of coming-out-of, it takes no initial mutation, and it is
 * already in the government table demanding FOIRM.BUN. But no Irish
 * grammatical phenomenon produces the rule that a declared category may have a
 * table behind it. The six questions were not passed and are not claimed. This
 * is a bit, like the counties, and it is enforced anyway.
 *
 * Three things this file exists to hold, and nothing else:
 *
 *  1. THE TABLE NAME, derived from the type name and from nothing else. There
 *     is no second name to write and therefore no second name to keep in sync.
 *
 *  2. THE REGISTRY, so that one place can answer "which table does this type
 *     read from, and what columns does it have" for the analyzer, the backend
 *     and `--paraidím` alike.
 *
 *  3. THE CEILING, stated out loud, because it is smaller than it looks.
 *
 * ── On pluralisation ──────────────────────────────────────────────────
 *
 * The table for `struchtúr Duine stór` is `duine`. It is not `daoine`, and the
 * compiler will never make it `daoine`, because `duine → daoine` is suppletive
 * and no rule reaches it. Irish plural formation is productive but wildly
 * irregular, and the one worked example the repository already contains is the
 * worst case in the language.
 *
 * This is §5.10's finding arrived at a second time by a different road. Gender
 * inference was refused because the ending rules say nothing at all about the
 * fifth of nouns that end in a vowel, `duine` among them. Plural inference is
 * refused because the ending rules say the wrong thing about `duine`
 * specifically. A rule that is silent is survivable; a rule that is confidently
 * wrong on the first word anyone will try is not.
 *
 * So the table name is the type's lemma, lowercased, singular, fadas kept.
 * `feidhmchlár/` keeps its `daoine` table and keeps reaching it through the
 * untyped path, and that is not a migration owed — it is the demonstration
 * that this feature is additive.
 *
 * ── On the ceiling ────────────────────────────────────────
 *
 * Thirty-two, and a table claims a county rather than a province.
 *
 * That is not an exemption from the province rule and it must not be read as
 * one. Two registries exist at two granularities, and they collide:
 *
 *   an ordinary placed type   claims a PROVINCE   — 4 slots
 *   a `stór` type             claims a COUNTY     — 32 slots
 *
 * A type is the vocabulary of a region. A table is a building in one town. It
 * is a smaller thing and it claims a smaller place, and the asymmetry is the
 * whole content of the rule.
 *
 * Marking a type `stór` therefore does not remove it from contention — it
 * changes the shape of its claim. A table in Corcaigh blocks any ordinary type
 * from claiming An Mhumhain; an ordinary type in An Mhumhain blocks a table
 * anywhere in Munster. So the marker is not an escape hatch from E603, and
 * `craobh/`, which spends all four provinces on ordinary types, still cannot
 * have a single table. Thirty-two is reachable only by a program that has no
 * ordinary placed types at all.
 *
 * The claim rule lives in `Anailiseoir.eiligh`, with every other placement
 * check, and not here. This file holds the number and the name.
 *
 * ── What 32 slots did to the rivalry table ────────────────────
 *
 * With four province slots, a rivalry could only ever bite the *reading* side:
 * two counties in one province could never both hold a type, so the flagship
 * pair `Corcaigh`/`Ciarraí` was reachable only in the direction nobody was
 * looking (§7.2 says so in those words).
 *
 * With 32 county slots it bites in the direction people were looking. Two
 * tables can now sit in rival counties, and then **no file can read both** —
 * not from Corcaigh, not from Ciarraí, not from anywhere else under a treaty,
 * because no treaty between rivals can exist. That is §7.5's `craobh/`
 * squeeze reproduced at table granularity, and it arrived without a line of
 * code being written for it.
 */

/**
 * The most tables any compiled module graph can hold.
 *
 * Not a limit this file imposes. It is the count of counties, arrived at from
 * outside: a table needs a county (E610) and a county holds one table (E612).
 * Recorded here so the number is written down somewhere a reader will find it,
 * and asserted in `test/stór.js` against `CONTAETHA.size` so that it stops
 * being true loudly rather than quietly.
 *
 * Read it as a ceiling and not as a budget. A program reaches it only by
 * having no ordinary placed types whatsoever; one ordinary type costs a whole
 * province's worth of counties.
 */
const UASMHEID = 32;

/**
 * The table a type reads from.
 *
 * Lowercased and nothing else. No pluralisation, no stemming, no lookup — see
 * the head of this file. `Duine` → `duine`, `Aois` → `aois`,
 * `TaifeadCuairte` → `taifeadcuairte`, which is ugly and is left ugly: a
 * camelCase identifier is not a word (§5.12.3 makes the same point about the
 * gender dictionary) and this file does not get an opinion about it.
 */
function ainmTabla(ainmCineail) {
  return ainmCineail.toLowerCase();
}

/**
 * The tables in view from one module: its own, plus everything an import
 * brought with it.
 *
 * Built exactly the way `cuigeGafa` is built — locally declared entries plus
 * entries replayed out of every imported signature — and for the same reason:
 * a registry that stopped at the file boundary would be a registry a second
 * file could ignore. Nothing was added to `síniú` to make this work. The
 * authoritative fact about one type is `cineal.stor`, which sits on the type
 * record beside `contae`, so a table crosses a module boundary because a type
 * does.
 *
 * This class is therefore a *view* and not a source of truth. The type checker
 * never consults it; `--graf` and the ceiling do.
 *
 * Keyed by type name rather than by county, deliberately. The county is what
 * makes the slot scarce; the type name is what a reader writes and what the
 * backend needs. Keying by county would make the map's shape argue for the
 * corrected ceiling above, and then the map would be wrong the day the
 * province rule changes.
 */
class ClarlannTablai {
  constructor() {
    // ainm an chineáil → { cineál, tábla, contae, réimsí, ionad }
    this.taifid = new Map();
  }

  /**
   * Register a `stór` type. Returns the record.
   *
   * No collision check here, and the absence is deliberate: `Anailiseoir.eiligh`
   * has already judged the placement by the time this is reached, and a second
   * check in a second place is a second thing to keep in step. Two tables in
   * one county are E612; a table inside a claimed province, or a province claim
   * over a county holding a table, are E603 in both directions.
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

  /** The record for a type name, or null. Null is the E611 case. */
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
