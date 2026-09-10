'use strict';

/*
 * contaetha.js — na 32 contae, na ceithre chúige, agus an rud a bhíonn ann
 * nuair nach bhfuil áit ar bith ann.
 *
 * Vocabulary, not grammar. This is the same status `Iasacht` has in
 * analyzer.js, and it is stated here for the same reason: so that nobody
 * later mistakes it for something that came out of the language.
 *
 * `as` itself is real Irish. It is the preposition of provenance and
 * belonging — *is as Corcaigh mé*, *fear as Doire*, *as Gaillimh* — it is
 * unclaimed in EOCHAIRFHOCAIL, it does not collide with `ó`, and it takes no
 * initial mutation, because the leniting set is `ar de do faoi ó roimh trí um
 * mar gan` and `as` is not in it. So `as` demands FOIRM.BUN, which is what
 * every operator except `ó`, `ar` and `a` already demands, and the government
 * table does not grow. `as Chorcaigh` is E103 with no new code: the mechanism
 * polices `as` correctly by doing nothing.
 *
 * The *list*, though, is a fixed table of proper names the compiler happens to
 * ship. No Irish grammatical phenomenon produces it. The county system is a
 * bit — deliberate, rigorously enforced, and not claimed to have passed the
 * six questions (DEARADH.md §24, §25). Do not let the fact that `as` is well
 * motivated launder the table into a grammar feature. In 0.7 the bit stops
 * being decoration and becomes the constraint the programmer plans around,
 * and that makes it *more* important to keep saying it is a bit, not less.
 *
 * Three consequences worth writing down where someone will read them:
 *
 *  1. The set is closed at 32. That is the point, and it is what makes an
 *     unrecognised name a real diagnostic (E602) instead of a free-form tag.
 *
 *  2. Six names carry the definite article — *An Mhí*, *An Clár*, *An Dún* —
 *     and one carries the genitive plural article, *Dún na nGall*. The
 *     definite article is NOT implemented and nothing here implements it
 *     (§35 stands, and Part 4 of the 0.6 brief stands). These are opaque
 *     word sequences in a lookup table. No rule about `an` or `na` is stated,
 *     derived, or reachable from this file. The province names are in the
 *     same position and get the same treatment: `An Mhumhain` is one opaque
 *     string, it is never written in a program, and nothing parses it.
 *
 *  3. `nGall` in *Dún na nGall* is an eclipsed form, and so is `Fhailí` in
 *     *Uíbh Fhailí* a lenited one. Both are frozen inside proper names. They
 *     are not produced by morphology.js and they demand nothing:
 *     `foirmDe(lemma, FOIRM.URAITHE)` still throws, because there is still no
 *     syntactic slot that asks for eclipsis (§12). The temptation to reach
 *     for `as an mbaile` is explicitly refused: that eclipsis belongs to the
 *     article, which is future research. Provinces do not change this. There
 *     is no `as An Mhumhain` in the language and there is not going to be.
 *
 * All of the Irish here needs a fluent reader. The county names are standard
 * and I am confident in them; `deoraíocht` in this position, and the wording
 * of the 6xx messages in diagnostics.js, are the things to check.
 */

/**
 * `deoraíocht` — "exile". Where a value is when it is from nowhere:
 * primitives, `Iasacht`, and any `struchtúr` declared without `as`.
 *
 * Three asymmetries against a real county, all deliberate (§24.3, §25.4):
 *
 *   - It is non-exclusive. A province holds one struct; exile holds any
 *     number, because exile is not a place and so has no single occupant.
 *     Without this a program could hold at most four struct types in total.
 *
 *   - It cannot sign a treaty. An agreement is between two parties and exile
 *     is not a party. So exile trades with nobody, and no `comhaontú` can
 *     rescue it. What is *not* forbidden is exile↔exile, because that is not
 *     trade: there is no border between two things that are from nowhere.
 *
 *   - It is nobody's rival. Exile has no history with anyone. `isIomaiocht`
 *     is therefore false the moment either side is in exile, which is what
 *     keeps the 0.7 veto out of every 0.4, 0.5 and 0.6 program.
 *
 * It is not writable. You do not declare yourself from exile; exile is what
 * you are when you declare nothing. `as deoraíocht` is E605.
 */
const DEORAIOCHT = 'deoraíocht';

const CUIGI = Object.freeze({
  LAIGHIN: 'Laighin',
  MUMHAIN: 'An Mhumhain',
  CONNACHTA: 'Connachta',
  ULAIDH: 'Ulaidh',
});

/** The four, in order, for the invariant check and for `--graf`. */
const CUIGI_UILE = Object.freeze([
  CUIGI.LAIGHIN, CUIGI.MUMHAIN, CUIGI.CONNACHTA, CUIGI.ULAIDH,
]);

/*
 * `cúige` is now load-bearing and `cósta` is still inert.
 *
 * Until 0.7 both axes were carried and read by nothing, so that county
 * personality would have real properties to derive from rather than 32
 * hand-authored behaviours that rot into "why does Liatroim do *that*". The
 * province exclusivity rule (§25.2) reads `cúige`, and the border check reads
 * it on every `ó`. `cósta` is untouched and still waiting on the one candidate
 * worth building first: restricting `ó "…"` on foreign modules to coastal
 * counties, because ports import goods and ports import modules.
 *
 * `cósta` is sea coast, so Liatroim is coastal on the strength of about four
 * kilometres at Tullaghan, and Ard Mhacha is not coastal despite Loch nEathach.
 */
const TABLA = [
  // ainm                  cúige              cósta
  ['Baile Átha Cliath',    CUIGI.LAIGHIN,     true],
  ['An Mhí',               CUIGI.LAIGHIN,     true],
  ['Lú',                   CUIGI.LAIGHIN,     true],
  ['Cill Mhantáin',        CUIGI.LAIGHIN,     true],
  ['Loch Garman',          CUIGI.LAIGHIN,     true],
  ['Cill Dara',            CUIGI.LAIGHIN,     false],
  ['Ceatharlach',          CUIGI.LAIGHIN,     false],
  ['Cill Chainnigh',       CUIGI.LAIGHIN,     false],
  ['Laois',                CUIGI.LAIGHIN,     false],
  ['Uíbh Fhailí',          CUIGI.LAIGHIN,     false],
  ['An Iarmhí',            CUIGI.LAIGHIN,     false],
  ['An Longfort',          CUIGI.LAIGHIN,     false],

  ['Corcaigh',             CUIGI.MUMHAIN,     true],
  ['Ciarraí',              CUIGI.MUMHAIN,     true],
  ['Luimneach',            CUIGI.MUMHAIN,     true],
  ['An Clár',              CUIGI.MUMHAIN,     true],
  ['Port Láirge',          CUIGI.MUMHAIN,     true],
  ['Tiobraid Árann',       CUIGI.MUMHAIN,     false],

  ['Gaillimh',             CUIGI.CONNACHTA,   true],
  ['Maigh Eo',             CUIGI.CONNACHTA,   true],
  ['Sligeach',             CUIGI.CONNACHTA,   true],
  ['Liatroim',             CUIGI.CONNACHTA,   true],
  ['Ros Comáin',           CUIGI.CONNACHTA,   false],

  ['Dún na nGall',         CUIGI.ULAIDH,      true],
  ['Doire',                CUIGI.ULAIDH,      true],
  ['Aontroim',             CUIGI.ULAIDH,      true],
  ['An Dún',               CUIGI.ULAIDH,      true],
  ['Ard Mhacha',           CUIGI.ULAIDH,      false],
  ['Tír Eoghain',          CUIGI.ULAIDH,      false],
  ['Fear Manach',          CUIGI.ULAIDH,      false],
  ['Muineachán',           CUIGI.ULAIDH,      false],
  ['An Cabhán',            CUIGI.ULAIDH,      false],
];

/** ainm → { ainm, cúige, cósta, focail }. Insertion order is table order. */
const CONTAETHA = new Map(TABLA.map(([ainm, cuige, costa]) => [ainm, Object.freeze({
  ainm, cuige, costa, focail: Object.freeze(ainm.split(' ')),
})]));

/**
 * Every word that begins some county name. This is what `as` resolves its
 * complement against, so that the ordinary agreement check has something to
 * ask about — exactly as `ó` asks the symbol table.
 */
const CEANNFHOCAIL = new Set([...CONTAETHA.values()].map((c) => c.focail[0]));

/** Every word-prefix of every name, joined, for the greedy read. */
const REAMHRAIN = new Set();
for (const c of CONTAETHA.values()) {
  for (let n = 1; n <= c.focail.length; n++) REAMHRAIN.add(c.focail.slice(0, n).join(' '));
}

/** Could `focail` still be the start of some county name? */
const isReamhran = (focail) => REAMHRAIN.has(focail.join(' '));

/** Does some county name begin with this word? The predicate `as` governs. */
const isCeannAinm = (focal) => CEANNFHOCAIL.has(focal);

const isContae = (ainm) => CONTAETHA.has(ainm);

/**
 * The province of a county, and `deoraíocht` for exile.
 *
 * Exile answering as its own province is what keeps the border rule at four
 * cases and one comparison (§25.3). Same province and both-exile collapse
 * into a single equality here, exactly as same-county and both-exile
 * collapsed into a single equality in 0.6, and for the same reason: two
 * things from nowhere are the same nowhere.
 *
 * An unknown name answers `deoraíocht` rather than throwing. `reitighContae`
 * has already filed E602 and returned exile by the time anything asks, so
 * this is defensive only; it must never be the thing that reports the fault.
 */
const cuigeDe = (ainm) => {
  const c = CONTAETHA.get(ainm);
  return c ? c.cuige : DEORAIOCHT;
};

/** The counties of a province, in table order. Used by `--graf`. */
const contaethaCuige = (cuige) =>
  [...CONTAETHA.values()].filter((c) => c.cuige === cuige).map((c) => c.ainm);

/**
 * Traditional rivalries. Read by the analyzer, and this is a reversal.
 *
 * §24.5 refused exactly this and the refusal was right at the time: with 32
 * slots a treaty was paperwork nobody planned around, so a refused pair was a
 * joke that fires once and then sits in the compiler as a hard-coded
 * exception in a system whose only claim to seriousness is uniformity. Three
 * things changed in 0.7 and all three are needed to reverse it:
 *
 *  1. With four slots a treaty is a real constraint on a real decision, so a
 *     blocked pair changes what you write instead of raising an eyebrow.
 *
 *  2. It is not an exception to the border rule. The veto sits *above* the
 *     four cases and applies uniformly to all of them, which is a different
 *     structure from a special case inside one of them. Rivals do not trade:
 *     not across a province line, not inside one province, and not under a
 *     treaty, because no treaty between them can exist (E608).
 *
 *  3. It is a short hand-authored list of *pairs*, not 32 hand-authored
 *     behaviours, so it does not hit the §24.4 rot problem. `seiceailTabla`
 *     enforces the bound that keeps that true.
 *
 * Two kinds of pair, and both bite, which is the thing the 0.7 brief got
 * wrong. The brief assumed intra-province pairs were dead under exclusivity —
 * two counties in one province can never both hold a struct, so they can
 * never both be placed. True, and irrelevant: the accessing side of the
 * border check is the *module's* county, and exclusivity constrains that not
 * at all. Any number of files may be from Ciarraí. So `Corcaigh`/`Ciarraí` is
 * not unreachable; it is the flagship case, and it is unreachable only in the
 * direction nobody was looking.
 *
 *   intra-province   a file that cannot open its own province's type
 *   cross-province   a treaty that cannot be signed (E608)
 *
 * The list is football and hurling, and it is meant to be recognised rather
 * than defended on the merits. All eleven are documented rivalries with their
 * own literature; if one is ever cut it should be cut for being unrecognised,
 * not for being unfair.
 */
const IOMAIOCHT = [
  // laistigh de chúige — an comhad in aghaidh a chineáil féin
  ['Corcaigh', 'Ciarraí'],                    // An Mhumhain
  ['Baile Átha Cliath', 'An Mhí'],            // Laighin
  ['Gaillimh', 'Maigh Eo'],                   // Connachta
  ['Aontroim', 'An Dún'],                     // Ulaidh
  ['Cill Chainnigh', 'Loch Garman'],          // Laighin
  ['Dún na nGall', 'Tír Eoghain'],            // Ulaidh

  // trasna cúigí — an comhaontú nach ndéantar
  ['Baile Átha Cliath', 'Ciarraí'],           // Laighin ↔ An Mhumhain
  ['Baile Átha Cliath', 'Maigh Eo'],          // Laighin ↔ Connachta
  ['Ciarraí', 'Tír Eoghain'],                 // An Mhumhain ↔ Ulaidh
  ['Cill Chainnigh', 'Tiobraid Árann'],       // Laighin ↔ An Mhumhain
  ['Cill Chainnigh', 'Corcaigh'],             // Laighin ↔ An Mhumhain
];

/**
 * Exile is nobody's rival, so this is false the moment either side is in
 * exile. That is not a special case written here — it falls out of exile not
 * being in the table — but it is the reason every pre-0.7 program is
 * untouched by the veto, so it is worth knowing where it comes from.
 */
const isIomaiocht = (a, b) =>
  IOMAIOCHT.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** Every county this one refuses to deal with. Presentation, for `--graf`. */
const iomaitheoiri = (ainm) => IOMAIOCHT
  .filter(([x, y]) => x === ainm || y === ainm)
  .map(([x, y]) => (x === ainm ? y : x));

/**
 * The invariants the language depends on, checked by the test suite rather
 * than thrown at require time.
 *
 * The prefix one is still the load-bearing one for the *parser*: no county
 * name is a proper prefix of another, so reading identifiers greedily while
 * the phrase remains a prefix is unambiguous and there is no backtracking. If
 * a name is ever added that breaks it, the reader stops being able to tell
 * where a county ends and the next statement begins.
 *
 * The rivalry ones are the load-bearing ones for the *language*, and the last
 * is the answer to "is there an escape?" (§25.5). A rivalry is absolute — no
 * treaty lifts it and there is no `sos cogaidh` — so the only guarantee that
 * the four-slot squeeze never makes a reasonable program impossible is that
 * for every pair of provinces there is at least one legal pair of counties to
 * place them in. That is what bounds the list: it may grow until it would
 * seal a province pair shut, and then it may not grow any further. The bound
 * is mechanical rather than a promise to be tasteful, which is the whole
 * difference between this and the 32 hand-authored behaviours §24.4 refused.
 */
function seiceailTabla() {
  const fadhbanna = [];
  if (CONTAETHA.size !== 32) fadhbanna.push(`${CONTAETHA.size} contae, ní 32`);
  if (CONTAETHA.has(DEORAIOCHT)) fadhbanna.push('tá an deoraíocht sa tábla');
  if (CUIGI_UILE.length !== 4) fadhbanna.push(`${CUIGI_UILE.length} cúige, ní 4`);

  const ainmneacha = [...CONTAETHA.keys()];
  for (const a of ainmneacha) {
    for (const b of ainmneacha) {
      if (a === b) continue;
      const fa = CONTAETHA.get(a).focail;
      const fb = CONTAETHA.get(b).focail;
      if (fb.length > fa.length && fa.every((w, i) => w === fb[i])) {
        fadhbanna.push(`is réamhrán é "${a}" de "${b}"`);
      }
    }
  }

  // Every province is occupied by at least one county, or a slot exists that
  // nothing can ever claim.
  for (const c of CUIGI_UILE) {
    if (!contaethaCuige(c).length) fadhbanna.push(`níl aon chontae i g${c}`);
  }

  // Every rivalry names two distinct real counties, once.
  const feicthe = new Set();
  for (const [a, b] of IOMAIOCHT) {
    if (!isContae(a)) fadhbanna.push(`ní contae é "${a}" san iomaíocht`);
    if (!isContae(b)) fadhbanna.push(`ní contae é "${b}" san iomaíocht`);
    if (a === b) fadhbanna.push(`iomaíocht le duine féin: "${a}"`);
    const eochair = [a, b].sort().join('\u0000');
    if (feicthe.has(eochair)) fadhbanna.push(`iomaíocht faoi dhó: ${a} / ${b}`);
    feicthe.add(eochair);
  }

  // The escape. For every pair of provinces some legal placement exists, so a
  // rivalry never seals two provinces off from each other — it only ever
  // costs you the county you wanted.
  for (const p of CUIGI_UILE) {
    for (const q of CUIGI_UILE) {
      if (p === q) continue;
      const saor = contaethaCuige(p)
        .some((a) => contaethaCuige(q).some((b) => !isIomaiocht(a, b)));
      if (!saor) fadhbanna.push(`níl aon phéire dleathach idir ${p} agus ${q}`);
    }
  }

  return fadhbanna;
}

module.exports = {
  DEORAIOCHT, CUIGI, CUIGI_UILE, CONTAETHA, CEANNFHOCAIL, IOMAIOCHT,
  isReamhran, isCeannAinm, isContae, isIomaiocht, iomaitheoiri,
  cuigeDe, contaethaCuige, seiceailTabla,
};
