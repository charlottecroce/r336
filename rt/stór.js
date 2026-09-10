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
 *     seasmhach stórlann = ó "../rt/stór.js"
 *     seasmhach stór     = tar éis oscail ó stórlann(":memory:")
 *     seasmhach rónna    = tar éis ceistigh ó stór("SELECT …", [])
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
}

/**
 * node:sqlite hands back null-prototype rows. R336 reads members through
 * `ó`, which compiles to a property read, so a plain object is what we want.
 */
function rónNormalaithe(rón) {
  return Object.assign({}, rón);
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
