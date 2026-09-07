# SB

A programming language.

```sb
struchtúr Duine {
    ainm: Teaghrán
    aois: Uimhir
}

feidhm beannacht ó Dhuine(féin) -> Teaghrán {
    "Dia duit, " + ainm ó fhéin
}

seasmhach duine = Duine { ainm: "Charlotte", aois: 20 }

scríobh beannacht ó dhuine()
```

`duine` and `dhuine` are one binding. `ó` governs its complement and demands the lenited form; the analyzer resolves the surface form back to the lemma; the JavaScript backend emits `Duine$beannacht(duine)` and never sees a mutation.

## Úsáid

```
node bin/sbc.js examples/beannacht.sb --rith        # compile and run
node bin/sbc.js examples/beannacht.sb --amharc      # show the JavaScript
node bin/sbc.js examples/beannacht.sb --paraidím    # show every grammatical form
node bin/sbc.js examples/beannacht.sb --crann       # show the AST
node bin/sbc.js feidhmchlár                         # compile a whole directory
node test/run.js                                    # 49 tests
```

Node 22+ (the store uses the built-in `node:sqlite`). No dependencies for the
compiler; the sample application needs `express` and `ejs`.

## Na gnéithe

| construct | Irish phenomenon | means |
|---|---|---|
| `ainm ó dhuine` | preposition of origin, lenites its complement | member of |
| `dhuine` / `duine` | initial mutation as agreement | one lemma, many forms |
| `duine is Duine` | copula — identification | classification |
| `bí duine` | substantive verb — existence | presence / state |
| `feidhm` / `gníomh` | indicative vs imperative mood | expression vs statement |
| `ag f()` / `tar éis f()` | progressive vs perfect aspect | pending vs settled |
| `Router ó "express"` | the same `ó`, foreign origin | import |
| `feidhm m ó Dhuine(féin)` | the same `ó`, a category possessor | method |

Every one of those has an argument behind it in `DEARADH.md`, including the
ones that are vocabulary rather than grammar and say so.

## Céimeanna

All six phases of the spec are implemented.

1. **Croíthiomsaitheoir** — lexer, parser, AST, primitives, `seasmhach`,
   `feidhm`, calls, `struchtúr`, type checking.
2. **Córas gramadaí** — identifier paradigms, lenition, government and
   agreement, `ó`, possessive semantics, methods.
3. **`is` agus `bí`** — classification kept separate from existence.
4. **Express** — `ó "modúl"` imports, `Iasacht` at the boundary, `.sb`
   modules inside a Node application.
5. **Aistriú de réir a chéile** — `feidhmchlár/` runs JavaScript, Spicebag and
   EJS together; the Express wiring stays in JavaScript on purpose.
6. **Ciseal bunachair** — `rt/stór.js`, a Spicebag database abstraction over
   SQLite with a pluggable driver and no Prisma anywhere.

Deliberately absent: eclipsis (§12), mutable bindings (§6), relative clauses
(§19), the vocative (§20), the definite article (§21), gender (§22).

## Struchtúr an tionscadail

```
spicebag/
├── bin/sbc.js              the compiler driver
├── src/
│   ├── morphology.js       Irish initial mutation. Knows no programming.
│   ├── diagnostics.js      Irish messages behind stable codes
│   ├── lexer.js            .sb → tokens; also the verb pre-scan
│   ├── parser.js           tokens → grammatical AST
│   ├── analyzer.js         government, agreement, types, mood, aspect
│   ├── codegen.js          resolved AST → JavaScript
│   └── index.js            pipeline and file handling
├── rt/stór.js              the database abstraction (Céim 6)
├── examples/
│   ├── beannacht.sb        the §24 program
│   ├── seilbh.sb           chained possession
│   ├── copail.sb           is vs bí
│   ├── modhanna.sb         methods through ó
│   ├── modh.sb             imperative vs indicative
│   ├── aspect.sb           ag / tar éis over the store
│   └── earraidi/           one file per diagnostic, each failing on purpose
├── feidhmchlár/            Céim 4 and 5: Express + EJS + Spicebag + SQLite
│   ├── freastalaí.js       JS — wiring
│   ├── bealaí.sb           SB — route logic
│   ├── sonraí.sb           SB — data access
│   └── amhairc/*.ejs       EJS — untouched
├── test/run.js
├── DEARADH.md              why each feature exists, and what is still open
└── README.md
```

## An feidhmchlár

```
cd feidhmchlár
npm install
npm run tosaigh        # compiles the .sb files, then serves on :3000
```

`GET /` lists people from SQLite through `bealaí.sb`; `GET /duine/1` shows one;
`GET /duine/abc` returns 400, because the copula asks whether the borrowed id
belongs to the category `Uimhir` and `NaN` does not.