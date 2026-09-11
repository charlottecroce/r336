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
};

class Stór {
  constructor(tiománaí, db, conair) {
    this.__cineál = 'Stór';
    this.tiománaí = tiománaí;
    this.db = db;
    this.conair = conair;
  }

  /** Read. A query asks a question, so on the R336 side it is a feidhm. */
  async ceistigh(sql, params = []) {
    return this.tiománaí.gach(this.db, sql, params).map(rónNormalaithe);
  }

  /** Write. An insert obeys an instruction, so on that side it is a gníomh. */
  async feidhmigh(sql, params = []) {
    return this.tiománaí.rith(this.db, sql, params);
  }

  async scéim(sql) { this.tiománaí.scéim(this.db, sql); }

  async dún() { this.tiománaí.dún(this.db); }

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
    const colúin = réimsí.map(aitheantóirLuaite).join(', ');
    const rónna = this.tiománaí.gach(
      this.db,
      `SELECT ${colúin} FROM ${aitheantóirLuaite(tábla)}`,
      [],
    );
    return rónna.map((rón) => Object.assign({ __cineál: cinéal }, rón));
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
