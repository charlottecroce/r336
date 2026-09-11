# R336

A programming language whose syntax is grounded in Irish grammar — lenition,
eclipsis, the copula, verbal mood and aspect, VSO word order, grammatical
gender. Not an English language with Irish keywords: the grammar is the
semantics, and the compiler has to understand it to compile anything.

Compiles to JavaScript. Requires Node 22 or newer.

```r336
struchtúr Duine {
    ainm: Teaghrán
    aois: Uimhir
}

feidhm beannacht(duine: Duine) -> Teaghrán {
    "Dia duit, " + ainm ó dhuine
}

duine seasmhach = Duine { ainm: "Charlotte", aois: 20 }

scríobh beannacht(duine)
```

```
$ node bin/r336c.js beannacht.r336 --rith
Dia duit, Charlotte
```

## Running it

```
node bin/r336c.js file.r336            # compile to file.js
node bin/r336c.js feidhmchlár          # compile every .r336 under a directory
node bin/r336c.js file.r336 --rith     # compile and run, awaiting príomh()
node bin/r336c.js file.r336 --amharc   # print the JavaScript, don't write it
node bin/r336c.js file.r336 --paraidím # every grammatical form of every binding
node bin/r336c.js file.r336 --crann    # the AST
node bin/r336c.js file.r336 --graf     # the module graph, provinces and treaties
```

```
npm test                # every suite
node test/index.js -v   # every suite, a line per test
node test/suim.js       # one suite alone
```

## Layout

| | |
|---|---|
| `src/` | the compiler: lexer, parser, analyzer, codegen, module graph, plus the Irish-morphology library |
| `rt/` | runtime: the database abstraction, primitive conversions, an Express bridge |
| `bin/r336c.js` | the CLI |
| `examples/` | one `.r336`/`.js` pair per feature - the compiled output is committed alongside the source on purpose |
| `examples/earraidi/` | one file per diagnostic code, each failing on purpose with exactly that code |
| `feidhmchlár/`, `craobh/` | example applications |
| `test/` | tests |
| `docs/` | docs |

## Status

## License

MIT. See [LICENSE](LICENSE).