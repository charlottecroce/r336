# SB

A programming language grounded in Irish grammar. Source files are `.sb`; the
compiler emits JavaScript and runs on Node ≥ 22.

```
suim Toradh as Gaillimh {
    Ceart  { duine: Duine }
    Easpa  { cúis: Teaghrán }
}

feidhm tuairisc(toradh: Toradh) -> Teaghrán {
    más Ceart toradh { ainm ó dhuine ó thoradh } mura { cúis ó thoradh }
}
```

**Version 0.10.1.** 309 tests across five suites.

> **This file was rewritten at 0.9.** The previous version described the 0.4
> six-phase project and a `src/` tree with no `contaetha.js`, no `modúil.js`,
> no counties, no provinces and no sum types. It had not noticed three
> releases. If you are looking for the old text, it is in the history.

---

## The rule the project runs on

Every unusual syntax feature must have a linguistic justification. Do not
invent a programming concept and attach an Irish word to it. Start with an
actual Irish grammatical phenomenon, understand the relationship it expresses,
then find the programming relationship that resembles it.

Six questions, asked of everything:

1. What actual Irish grammatical phenomenon inspired this?
2. What relationship does that phenomenon express in Irish?
3. What programming relationship resembles it?
4. Does the analogy remain coherent when used repeatedly?
5. Does the compiler need to understand the grammar to implement it?
6. Is the feature useful enough to justify its complexity?

**Rejection is a real and expected outcome, and the write-ups are part of the
value.** `dá` was rejected in §14. Ownership from the prepositional pronouns —
described in every brief since 0.5 as the strongest unbuilt idea in the
project — was examined and rejected in §32, and the rejection produced the ordering
that unblocks it: pronouns first, ownership after.

**Two standing exceptions, both labelled wherever they appear.** The county and
province system (§24.1, §25.1) is a deliberately strange artistic feature that
is then enforced rigorously: `as` is a real preposition governed by the
ordinary machinery, but the 32 counties, the four provinces, the treaties and
the rivalries are a bit. And the `suim` declaration (§26.1) is engineering;
only its *eliminator*, the copula, is Irish. Neither is dressed up as grammar
after the fact.

---

## Getting started

```
node bin/sbc.js examples/copail.sb --rith
npm test
```

### The CLI

| flag | what it does |
|---|---|
| *(none)* | compile to a sibling `.js` |
| `--rith` | compile and run, awaiting an exported `príomh` |
| `--amharc` | print the JavaScript without writing it |
| `--paraidím` | every grammatical form of every binding, plus the copula's paradigm |
| `--crann` | the abstract syntax tree |
| `--graf` | modules, provinces, treaties, and each type's provenance |

---

## Features

| feature | syntax | grounded in |
|---|---|---|
| lenition as government | `ainm ó dhuine` | initial mutation; §5, §6 |
| possession / origin | `ó` | the prepositional relation; §6 |
| mood | `feidhm`, `gníomh`, `saor` | indicative, imperative, autonomous; §4, §17, §37 |
| the copula | `is`, and `más` / `mura` / `murab` | classification, and its paradigm; §13, §31 |
| the substantive verb | `tá` / `bhfuil` | independent vs dependent; §14 |
| conditionals | `má` … `mura` | no word for *else*; the elided clause; §17 |
| aspect | `ag` (ongoing), `tar éis` (completed) | the progressive and perfect; §18 |
| the verbal noun | `a fhógair` | the particle that nominalises a verb; §18, §20 |
| iteration | `déan … ar …` | the light verb and its preposition; §21 |
| state | `seasmhach` / `sealadach`, `cuir … ar …` | essence against accident; §13, §14 |
| modules | `ó "./sonraí.sb"` | a reader acquires a lexicon before reading; §19 |
| **provenance** | `as Corcaigh`, `comhaontú` | *(a bit, and enforced)*; §24, §25 |
| **sum types** | `suim Toradh as Gaillimh { … }` | *(engineering; the eliminator is Irish)*; §26 |
| the autonomous verb | `saor liostaigh(…)`, `liostaítear x` | an action with no expressible agent; §37 |

### Deliberately absent

Not oversights. Each has an argument attached, and adding any of them casually
would break one.

- **A programming meaning for eclipsis.** `--paraidím` prints every eclipsed
  form labelled *gan bhrí, §12*, and `foirmDe(lemma, FOIRM.URAITHE)` throws.
  The one honest candidate anyone has found is numerals.
- **The definite article** (§35) — and refusing it is how eclipsis stays out
  through the back door, since *as an mbaile* eclipses.
- **Grammatical gender** (§36). 0.9 was the first release to test this: the
  ownership design needed the gendered `aige`/`aici`, and the design was
  rejected rather than the rule relaxed.
- **`dá`** (§14), **anonymous function literals** (no Irish construction for an
  unnamed verb), **classes, `this`, inheritance and constructors** (never).
- **Exhaustiveness checking on sums**, refused with an argument in §26.3.
- **Relative clauses and the vocative** (§33, §34).

The absence claim has got stronger three times and this file has now noticed:
**the article and eclipsis remain absent despite counties, provinces and sum
types** — three features that each brought them within reach and each declined
them explicitly.

---

## Layout

```
spicebag/
├── bin/sbc.js              the CLI
├── src/
│   ├── morphology.js       lenition, eclipsis, and three paradigms: bí, the
│   │                       copula, and the autonomous verb — the last one
│   │                       productive. Knows no programming.
│   ├── diagnostics.js      Irish messages behind stable codes
│   ├── contaetha.js        the 32, the 4 cúigí, exile, rivalry. Vocabulary.
│   ├── lexer.js            tokens; the verb pre-scan; the import pre-scan
│   ├── parser.js           tokens → grammatical AST
│   ├── analyzer.js         government, agreement, types, mood, aspect,
│   │                       state, modules, provenance, sums
│   ├── modúil.js           the module graph
│   ├── codegen.js          resolved AST → JavaScript
│   └── index.js            the pipeline
├── rt/                     stór.js, bunúsach.js, freastal.js — library, not
│                           language
├── examples/               one per feature, plus earraidi/ — one per diagnostic,
│                           each failing on purpose
├── feidhmchlár/            Express + EJS + Spicebag + SQLite
├── craobh/                 the four-province domain; all four spent
├── test/                   run.js · contae.js · feidhmchlár.js · suim.js ·
│                           earraidi.js
└── DEARADH.md              the design record, §1–§38
```

### Invariants

- **The backend never sees a mutation, a county, a province, or a sum.** The
  sum's name never appears in emitted JavaScript at all.
- **No driver knowledge in the compiler.** `sql`, `sqlite` and `prisma` appear
  nowhere in the front end, and there are tests asserting it.
- **One government mechanism.** `ó`, `ar`, `a` and `as` all route through
  `reitighFoirm`.
- **The eclipsed slot stays empty.** `foirmDe(lemma, FOIRM.URAITHE)` throws.
- **AST node names and internal identifiers are Irish.**
- **No grammatical form survives into the emitted JavaScript**, and each
  feature ships a test asserting it.

---

## Diagnostics

Codes are the contract; the wording is not. Messages are Irish and still need
review by a fluent speaker.

| range | subject |
|---|---|
| E101–E110 | morphology: mutation, form, resolution, modules |
| E201–E214 | types |
| E301–E302 | the copula and `bí` |
| E401–E404 | lexing and parsing |
| E501–E521 | mood, aspect, the copula's form, the autonomous verb |
| E601–E609 | provenance: province, county, exile, treaty |

Every diagnostic introduced from 0.5 onward has a file in `examples/earraidi/`
**Every code has a case, and a test enforces it in both directions.** 59 files
in `examples/earraidi/`, each failing with the code in its name and with no
other; and `test/earraidi.js` fails if any code in `diagnostics.js` lacks one.
This was 23 of 60 until 0.10.1 — see §38.

Two codes are reserved: they have a message and deliberately no way to fire,
each with a reason recorded in the test. **E211** was made real in 0.8 and
un-made in the same release (§26.7); **E506** describes a failure the backend
no longer produces. A reserved code that acquires a case is a failing test,
because the reservation was then wrong.


---

## Calibration

Spicebag has exactly one user: the person building it. **Usable does not mean
easy.** It means the compiler is internally consistent, every error is
diagnosable, and the author can still read their own code in six months.

## License

MIT.
