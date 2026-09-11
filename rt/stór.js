'use strict';

// rt/stór.js — teibíocht bunachair sonraí R336.
//
// This module owns the whole DB interface; R336 code never sees a driver:
//
//     R336  ->  Stór  ->  tiománaí  ->  SQLite
//
// Promise-returning even though node:sqlite is synchronous, so R336's
// ag/tar éis (async/await) fit any future driver, not just this one.
// Reached via `ó`:
//
//     stórlann seasmhach = ó "../rt/stór.js"
//     stór     seasmhach = tar éis oscail ó stórlann(":memory:")
//     rónna    seasmhach = tar éis ceistigh ó stór("SELECT …", [])
//
// `faigh` (0.12) is the only part of §41 that lives here rather than in the
// compiler: the compiler decides a type has a table and what it's called,
// this file decides how to read it. Takes table name, columns and the type's
// tag; hands back tagged rows so `__is` can read them.
//
// `cuir` (0.13) is `faigh`'s twin for writes: table name, columns, and a
// value instead of a tag (no tag needed going out — the column list says
// what to read off the value).
//
// `dearbhaighColúin` (0.13) answers what happens when the table on disk
// disagrees with the declared type: it refuses rather than silently
// dropping a missing field. Checking is not the same as generating a
// schema — that would need a type→column-type map, which is a second
// language's vocabulary this project isn't taking on. Cached per table per
// connection.

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
  // The columns a table actually has, via SQLite's own PRAGMA. A different
  // driver would answer this some other way.
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
    // tábla → Set of columns it has. Filled lazily on first use.
    this.scéimeanna = new Map();
  }

  /** Read. Asks a question, so `feidhm` on the R336 side. */
  async ceistigh(sql, params = []) {
    return this.tiománaí.gach(this.db, sql, params).map(rónNormalaithe);
  }

  /** Write. Obeys an instruction, so `gníomh` on the R336 side. */
  async feidhmigh(sql, params = []) {
    return this.tiománaí.rith(this.db, sql, params);
  }

  async scéim(sql) {
    this.tiománaí.scéim(this.db, sql);
    // A schema-changing statement invalidates everything we believe about
    // every table — cheap to drop, cheap not to guess wrong once.
    this.scéimeanna.clear();
  }

  async dún() { this.tiománaí.dún(this.db); }

  /**
   * The declared columns must be on the table, or we refuse and say which
   * one isn't. Extra columns on disk stay invisible — a struct states every
   * field it has, so a row with an unfielded extra isn't a value of that type.
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
   * Table name, field list and tag all come from the backend (derived from
   * the declared type), never from the programmer. A tag rather than a
   * constructor: an imported type's `$nua` isn't in scope in the reading file.
   * Identifiers are quoted rather than trusted.
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
   * `faigh`'s mirror: same table, same column order, value instead of tag.
   * One row per call — `cuir … i …` is a frame, not a verb, so `déan` can't
   * distribute it. Bulk write is simply not expressible yet.
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

/** node:sqlite hands back null-prototype rows; normalise to plain objects. */
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

/** First row, or undefined. */
function céad(rónna) { return rónna && rónna.length ? rónna[0] : undefined; }

module.exports = { oscail, céad, Stór, TIOMANAITHE };