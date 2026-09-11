'use strict';

/*
 * rt/stór.js — teibíocht bunachair sonraí R336.
 *
 * Phase 6 of the spec says the database layer must be R336's own
 * abstraction sitting over SQLite, not a set of Prisma-shaped language
 * features. So this module owns the whole interface, and nothing above it
 * knows what a driver is:
 *
 *     R336  →  Stór  →  tiománaí  →  SQLite
 *
 * The interface is promise-returning even though `node:sqlite` is synchronous.
 * That is deliberate: a driver over a socket cannot be synchronous, so the
 * abstraction must be async or it will only ever fit the one driver it was
 * written against. On the R336 side that shows up as `ag` / `tar éis`,
 * which is exactly the progressive/perfect distinction those markers carry.
 *
 * Presented to R336 as `Iasacht`, reached with the ordinary `ó` relation:
 *
 *     stórlann seasmhach = ó "../rt/stór.js"
 *     stór     seasmhach = tar éis oscail ó stórlann(":memory:")
 *     rónna    seasmhach = tar éis ceistigh ó stór("SELECT …", [])
 *
 * ── 0.12: `faigh` ─────────────────────────────────────────────────────
 *
 * One method is new, `faigh`, and it is the only part of §41 that is here
 * rather than in the compiler. The compiler decides *that* a type has a table
 * and *what it is called*; this file decides how a table is read. That split
 * is the same one the file already had — `ceistigh` owns the query language
 * and `sonraí.r336` owns none of it — and it is what keeps the driver
 * vocabulary out of `src/`, which `test/run.js` greps for and now greps for in
 * `táblaí.js` too.
 *
 * `faigh` takes the table name, the column list and the type's tag from the
 * compiler, and hands back rows already tagged, so `__is` can read them.
 * Nothing here knows what a `struchtúr` is: it receives three strings and a
 * list of strings, and it does not ask what they mean.
 *
 * ── 0.13: `cuir`, agus an dearbhú colún ───────────────────────────────
 *
 * Two additions, and they answer two different things.
 *
 * `cuir` is `faigh`'s twin and arrives for the same reason: `cuir X i stór`
 * on the R336 side (§7.6) hands down a table name, a column list and a value,
 * and the INSERT is built here so that no SQL is written above this file.
 * There is no tag on the way out, because a row leaving does not need one —
 * the column list says which fields to read off the value. `faigh` passes one
 * because `__is` wants a tag on the way back in.
 *
 * `dearbhaighColúin` answers §7.6.6's standing question: what happens when the
 * table on disk disagrees with the type in the file. Until now, nothing — a
 * declared column that was not there came back as a raw driver error naming
 * neither the type nor the field. The compiler will still not *generate* a
 * schema, because that needs a type→column-type map, which is another
 * language's vocabulary shipped inside this one. Checking is not supplying:
 * this is the move §5.12.1 makes about the gender dictionary, and it is the
 * reason the refusal to generate can stay a refusal rather than a gap.
 *
 * The check is cached per table per connection, so it costs one extra read the
 * first time a table is touched and nothing after that. **The interrogation
 * itself belongs to the driver, not to this class**: `PRAGMA table_info` is
 * SQLite's, not SQL's, and a driver over a socket would answer the question
 * some other way. So `colúin` joins `nasc`, `gach`, `rith`, `scéim` and `dún`
 * in the driver table below, which is exactly where everything
 * driver-specific already lives.
 */

const TIOMANAITHE = Object.create(null);

/** Driver over node:sqlite. `:memory:` is a real path here, so tests are free. */
TIOMANAITHE.sqlite = {
  ainm: 'sqlite',
  nasc(conair) {
    const { DatabaseSync } = require('node:sqlite');
    return new DatabaseSync(conair);
  },
  gach(db, sql, params) { return db.prepare(sql).all(...params); },
  rith(db, sql, params) {
    const r = db.prepare(sql).run(...params);
    return { athruithe: Number(r.changes ?? 0), aitheantóir: Number(r.lastInsertRowid ?? 0) };
  },
  scéim(db, sql) { db.exec(sql); },
  dún(db) { db.close(); },
  // 0.13 — the columns a table actually has. `PRAGMA table_info` is SQLite's
  // own and belongs here for that reason; a different driver answers the same
  // question with a different sentence. An empty list means no such table,
  // which the caller reports as such rather than guessing.
  colúin(db, tábla) {
    return db.prepare(`PRAGMA table_info(${aitheantóirLuaite(tábla)})`)
      .all()
      .map((r) => r.name);
  },
};

class Stór {
  constructor(tiománaí, db, conair) {
    this.__cineál = 'Stór';
    this.tiománaí = tiománaí;
    this.db = db;
    this.conair = conair;
    // tábla → Set de na colúin atá air. Ní líontar é ach nuair a bhaintear
    // úsáid as tábla den chéad uair.
    this.scéimeanna = new Map();
  }

  /** Read. A query asks a question, so on the R336 side it is a feidhm. */
  async ceistigh(sql, params = []) {
    return this.tiománaí.gach(this.db, sql, params).map(rónNormalaithe);
  }

  /** Write. An insert obeys an instruction, so on that side it is a gníomh. */
  async feidhmigh(sql, params = []) {
    return this.tiománaí.rith(this.db, sql, params);
  }

  async scéim(sql) {
    this.tiománaí.scéim(this.db, sql);
    // A statement that may have created or altered a table invalidates what we
    // believe about every table. Cheap to drop, and the alternative is a cache
    // that is quietly wrong exactly once, on the run where the schema changed.
    this.scéimeanna.clear();
  }

  async dún() { this.tiománaí.dún(this.db); }

  /**
   * §7.6.6 — the declared columns are on the table, or the program stops here
   * and says which one is not.
   *
   * The compiler knows the type's field list and nothing about the disk; the
   * disk knows its columns and nothing about the type. This is the only place
   * the two are ever in the same room, so it is the only place the question
   * can be asked. It refuses rather than adapting: a read that silently
   * dropped a missing field would hand R336 a value of a type it is not.
   *
   * Extra columns on disk are not an error and stay invisible — `id` in
   * `feidhmchlár/` is exactly that, and a `struchtúr` states every field it
   * has, so a row carrying one the type never declared is not a value of that
   * type but a row that happens to contain one.
   */
  dearbhaighColúin(tábla, réimsí) {
    let atá = this.scéimeanna.get(tábla);
    if (!atá) {
      atá = new Set(this.tiománaí.colúin(this.db, tábla));
      this.scéimeanna.set(tábla, atá);
    }
    if (!atá.size) {
      throw new Error(`stór: níl tábla "${tábla}" sa bhunachar seo.`);
    }
    for (const r of réimsí) {
      if (!atá.has(r)) {
        throw new Error(
          `stór: níl colún "${r}" ar an tábla "${tábla}". `
          + `Tá na colúin seo air: ${[...atá].join(', ')}.`,
        );
      }
    }
  }

  /**
   * `tar éis faigh Duine as stór` — every row of one table, typed.
   *
   * Three arguments, all three written by the backend and none of them by the
   * programmer: the table name (derived from the type name in `táblaí.js`),
   * the declared field names in declaration order, and the type's tag.
   *
   * A tag rather than a constructor, because an imported type's `$nua` is not
   * in scope in the file doing the reading, and because the tag is all `__is`
   * ever wanted. This file already sets `__cineál` on itself, so it is not
   * learning the convention here.
   *
   * The column list is explicit rather than `*` so that what comes back is
   * exactly the type and nothing else. A table with an `id` column the type
   * does not declare stays readable, and `id` stays invisible to R336, which
   * is right: a `struchtúr` states every field it has, so a row carrying a
   * field the type never declared is not a value of that type — it is a row
   * that happens to contain one.
   *
   * Identifiers are quoted rather than trusted. They arrive from R336 lemmas
   * and so cannot currently contain anything dangerous, but "cannot currently"
   * is a property of the lexer and this file is not the lexer.
   */
  async faigh(tábla, réimsí, cinéal) {
    this.dearbhaighColúin(tábla, réimsí);
    const colúin = réimsí.map(aitheantóirLuaite).join(', ');
    const rónna = this.tiománaí.gach(
      this.db,
      `SELECT ${colúin} FROM ${aitheantóirLuaite(tábla)}`,
      [],
    );
    return rónna.map((rón) => Object.assign({ __cineál: cinéal }, rón));
  }

  /**
   * `cuir duine i stór` — one row of one table, from a typed value.
   *
   * `faigh`'s twin, and deliberately its mirror image: the same table name,
   * the same column list in the same declared order, and the value instead of
   * the tag. Reading the fields off the value in that order is what keeps the
   * declared field list the single source of truth in both directions — there
   * is no second place to write a column list and therefore no second place
   * for one to drift.
   *
   * One row per call, because the R336 side cannot ask for more: `cuir … i …`
   * is a frame and not a verb, so `déan` cannot distribute it over a list.
   * That is what defers the transaction story honestly rather than by
   * omission (§7.6.6).
   */
  async cuir(tábla, réimsí, luach) {
    this.dearbhaighColúin(tábla, réimsí);
    const colúin = réimsí.map(aitheantóirLuaite).join(', ');
    const áiteanna = réimsí.map(() => '?').join(', ');
    return this.tiománaí.rith(
      this.db,
      `INSERT INTO ${aitheantóirLuaite(tábla)} (${colúin}) VALUES (${áiteanna})`,
      réimsí.map((r) => luach[r]),
    );
  }
}

/**
 * node:sqlite hands back null-prototype rows. R336 reads members through
 * `ó`, which compiles to a property read, so a plain object is what we want.
 */
function rónNormalaithe(rón) {
  return Object.assign({}, rón);
}

/** A quoted identifier. Doubling is how a quote escapes itself here. */
function aitheantóirLuaite(ainm) {
  return `"${String(ainm).replace(/"/g, '""')}"`;
}

/** oscail(":memory:") | oscail("./app.db", "sqlite") */
async function oscail(conair, ainmTiománaí = 'sqlite') {
  const t = TIOMANAITHE[ainmTiománaí];
  if (!t) throw new Error(`tiománaí anaithnid: ${ainmTiománaí}`);
  return new Stór(t, t.nasc(conair), conair);
}

/** First row, or undefined. Handy at the boundary; not a language feature. */
function céad(rónna) { return rónna && rónna.length ? rónna[0] : undefined; }

module.exports = { oscail, céad, Stór, TIOMANAITHE };
