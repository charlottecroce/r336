'use strict';

/*
 * cúlchríoch.js — the JavaScript backend.
 *
 * By the time we get here, morphology is gone. `dhuine` was resolved to the
 * lemma `duine` in the analyzer, so the emitter only ever sees lemmas. That
 * is the test of whether the grammatical layer is real: if the backend had to
 * know about lenition, we would only have written a find-and-replace (§2.4).
 *
 * Mood and aspect are gone too. An imperative is a plain function; `ag` is
 * `async`; `tar éis` is `await`; a method is a top-level function taking its
 * receiver first, dispatched statically because the analyzer already knew the
 * possessor's category.
 *
 * So is verb inflection: `tá` and `bhfuil` both emit `__bí`, because the
 * independent/dependent alternation is agreement, not meaning. The same proof
 * that applies to lenition applies here — if the backend had to know which
 * form was written, the distinction would be decoration.
 */

const REAMHRA = `// arna ghiniúint ag an tiomsaitheoir R336 — ná cuir eagar air
"use strict";
function __is(luach, cineál) {
  switch (cineál) {
    // NaN is stricter here than in JavaScript on purpose: the copula asks
    // what category a value belongs to, and NaN belongs to no numeric one.
    case "Uimhir": return typeof luach === "number" && !Number.isNaN(luach);
    case "Teaghrán": return typeof luach === "string";
    case "Bool": return typeof luach === "boolean";
    case "Liosta": return Array.isArray(luach);
    case "Neamhní": return luach === undefined || luach === null;
    case "Iasacht": return true;
    default: return luach !== null && typeof luach === "object" && luach.__cineál === cineál;
  }
}
function __bí(luach) { return luach !== undefined && luach !== null; }
function scríobh(luach) { console.log(luach); }
`;

/** `ó "./sonraí.r336"` refers to the module, which on disk is the compiled .js. */
const conair = (s) => (s.replace(/\.r336$/, '.js'));

class Ginteoir {
  constructor() { this.amach = []; this.leibhéal = 0; this.uimhirShealadach = 0; }
  líne(s) { this.amach.push('  '.repeat(this.leibhéal) + s); }
  sealadach() { return `__t${this.uimhirShealadach++}`; }

  clar(ast) {
    const onnmhairi = [];
    const beo = [];   // bindings sealadach: exported live, not as a snapshot
    // Verbs imported unqualified still have to come from somewhere at run
    // time. The alias is invisible in the source, as the lexicon is.
    for (const [foinse, ailias] of (ast.ailiasanna || new Map())) {
      this.líne(`const ${ailias} = require(${JSON.stringify(conair(foinse))});`);
    }
    for (const m of ast.mireanna) {
      // Provenance is decided entirely in the front end and emits nothing.
      // Deliberately no `__contae` on instances: `__cineál` is there because
      // `__is` reads it and `async` is there because `ag` means it, but
      // nothing at run time ever asks a value what county it is from. A tag
      // nobody reads would assert a guarantee the emitted code does not make.
      if (m.cineál === 'Contae' || m.cineál === 'Comhaontú') continue;
      if (m.cineál === 'Struchtúr') { this.struchtur(m); onnmhairi.push(`${m.ainm}$nua`); continue; }
      if (m.cineál === 'Suim') {
        // The sum itself emits nothing: it is a statement about which tags are
        // possible, and a statement about possibility has no run-time shadow.
        // Each variant gets the same tagging constructor a struct gets, so
        // `__is` needs no new case and the backend learns no new concept.
        for (const mal of m.malairti) { this.struchtur(mal); onnmhairi.push(`${mal.ainm}$nua`); }
        continue;
      }
      this.raiteas(m);
      if (m.cineál === 'Briathar' && m.jsAinm) onnmhairi.push(m.jsAinm);
      if (m.cineál === 'Ceangal' && m.ceangal) {
        (m.ceangal.sealadach ? beo : onnmhairi).push(m.ceangal.jsAinm);
      }
    }
    if (onnmhairi.length || beo.length) {
      this.líne('');
      this.líne(`module.exports = { ${[...new Set(onnmhairi)].join(', ')} };`);
      for (const b of new Set(beo)) {
        this.líne(`Object.defineProperty(module.exports, ${JSON.stringify(b)}, { get: () => ${b}, enumerable: true });`);
      }
    }
    return REAMHRA + '\n' + this.amach.join('\n') + '\n';
  }

  /** Types are erased, but a tagging constructor is kept for JS interop. */
  struchtur(m) {
    this.líne(`function ${m.ainm}$nua(réimsí) { return Object.assign({ __cineál: ${JSON.stringify(m.ainm)} }, réimsí); }`);
  }

  bloc(b, { toradh = false, réamhrá = '', sprioc = null } = {}) {
    this.líne(réamhrá + '{');
    this.leibhéal++;
    for (const r of b.raitis) this.raiteas(r);
    if (b.luach) {
      const luach = this.slonn(b.luach);      // may hoist lines before this one
      this.líne(sprioc ? `${sprioc} = ${luach};` : (toradh ? 'return ' : '') + luach + ';');
    }
    this.leibhéal--;
    this.líne('}');
  }

  raiteas(r) {
    switch (r.cineál) {
      case 'Struchtúr':
        return this.struchtur(r);

      case 'Suim':
        for (const mal of r.malairti) this.struchtur(mal);
        return;

      case 'Briathar': {
        const ps = r.params.map((p) => (p.ceangal ? p.ceangal.jsAinm : p.ainm)).join(', ');
        const pref = `${r.leanunach ? 'async ' : ''}function ${r.jsAinm || r.ainm}(${ps}) `;
        return this.bloc(r.corp, { toradh: r.modh === 'táscach', réamhrá: pref });
      }

      case 'Ceangal': {
        const ainm = r.ceangal ? r.ceangal.jsAinm : r.ainm;
        const eochair = r.ceangal && r.ceangal.sealadach ? 'let' : 'const';
        const luach = this.slonn(r.luach);
        return this.líne(`${eochair} ${ainm} = ${luach};`);
      }

      case 'Cuir': {
        const luach = this.slonn(r.luach);
        return this.líne(`${this.slonn(r.sprioc)} = ${luach};`);
      }

      case 'Má':
        return this.máRáiteas(r, null);

      case 'Ordú': {
        // `déan a fhógair ar dhaoine`. A `for…of` rather than `forEach`,
        // because an ongoing verb has to be awaited in sequence — commands are
        // sequential by nature — and because R336 has no closure to hand
        // a callback anyway.
        if (r.iteraid) {
          const g = this.slonn(r.argointi[0]);
          const xs = this.slonn(r.fras.abhar);
          const v = this.sealadach();
          return this.líne(`for (const ${v} of ${xs}) ${r.leanunach ? 'await ' : ''}${g}(${v});`);
        }
        const args = r.argointi.map((a) => this.slonn(a)).join(', ');
        const ainm = r.ceangal ? r.ceangal.jsAinm : r.ainm;
        return this.líne(`${r.leanunach ? 'await ' : ''}${ainm}(${args});`);
      }

      case 'Slonn':
        return this.líne(this.slonn(r.slonn) + ';');

      default:
        throw new Error(`ráiteas anaithnid sa chúlchríoch: ${r.cineál}`);
    }
  }

  /**
   * `má`/`mura` as a statement, or as an expression assigning into `sprioc`.
   * A bare `mura` is `else`; `mura <c>` is `else if (!(c))`.
   */
  máRáiteas(e, sprioc, réamhrá = '') {
    const cond = e.diultach ? `!(${this.slonn(e.coinniall)})` : this.slonn(e.coinniall);
    this.bloc(e.ansin, { réamhrá: `${réamhrá}if (${cond}) `, sprioc });
    if (!e.eile) return;
    if (e.eile.cineál === 'Má') return this.máRáiteas(e.eile, sprioc, 'else ');
    this.bloc(e.eile, { réamhrá: 'else ', sprioc });
  }

  /** A chain is a ternary only if no branch needs statements hoisted. */
  simpli(e) {
    const craobh = (b) => b.cineál === 'Má'
      ? this.simpli(b)
      : (!b.raitis.length && b.luach && !this.ardaitheach(b.luach));
    return craobh(e.ansin) && !!e.eile && craobh(e.eile);
  }

  /** Does this expression contain a `má` that would have to be hoisted? */
  ardaitheach(e) {
    if (!e || typeof e !== 'object') return false;
    if (e.cineál === 'Má') return !this.simpli(e);
    for (const k of Object.keys(e)) {
      const v = e[k];
      if (Array.isArray(v)) { if (v.some((x) => this.ardaitheach(x))) return true; }
      else if (v && typeof v === 'object' && v.cineál && this.ardaitheach(v)) return true;
    }
    return false;
  }

  máTéarnach(e) {
    const cond = e.diultach ? `!(${this.slonn(e.coinniall)})` : this.slonn(e.coinniall);
    const b = e.eile.cineál === 'Má' ? this.máTéarnach(e.eile) : this.slonn(e.eile.luach);
    return `(${cond} ? ${this.slonn(e.ansin.luach)} : ${b})`;
  }

  slonn(e) {
    switch (e.cineál) {
      case 'Uimhir': return String(e.luach);
      case 'Teaghrán': return JSON.stringify(e.luach);
      case 'Bool': return e.luach ? 'true' : 'false';
      case 'Neamhní': return 'null';
      case 'Liosta': return `[${e.mireanna.map((m) => this.slonn(m)).join(', ')}]`;

      case 'Aitheantóir':
        return e.ceangal ? e.ceangal.jsAinm : e.lemma || e.surface;

      case 'Bunús': {
        const req = `require(${JSON.stringify(conair(e.foinse))})`;
        return e.ball ? `${req}.${e.ball.lemma}` : req;
      }

      // The grammatical relation collapses to a property read only here.
      case 'Sealbhach': {
        const sealbh = this.slonn(e.sealbhoir);
        if (e.ionsuite === 'fad') return `${sealbh}.length`;
        if (e.ionsuite === 'folamh') return `(${sealbh}.length === 0)`;
        if (e.ionsuite === 'céad') return `${sealbh}[0]`;
        if (e.modhR336) return `((...a) => ${e.modhR336.jsAinm}(${sealbh}, ...a))`;
        return `${sealbh}.${e.ball.lemma}`;
      }

      case 'Glao': {
        const args = e.argointi.map((a) => this.slonn(a));
        const f = e.feidhm;
        // Static dispatch: the analyzer knew the possessor's category.
        if (f.cineál === 'Sealbhach' && f.modhR336) {
          return `${f.modhR336.jsAinm}(${[this.slonn(f.sealbhoir), ...args].join(', ')})`;
        }
        return `${this.slonn(f)}(${args.join(', ')})`;
      }

      case 'Déantús': {
        const cuid = e.reimsi.map((r) => `${r.lemma}: ${this.slonn(r.luach)}`);
        return `{ __cineál: ${JSON.stringify(e.cineal.ainm)}${cuid.length ? ', ' + cuid.join(', ') : ''} }`;
      }

      case 'Dénártha': {
        const op = e.op === '==' ? '===' : e.op === '!=' ? '!==' : e.op;
        return `(${this.slonn(e.clé)} ${op} ${this.slonn(e.deas)})`;
      }

      case 'Aonártha': return `(-${this.slonn(e.abhar)})`;
      case 'Copail': return `__is(${this.slonn(e.abhar)}, ${JSON.stringify(e.cineal.ainm)})`;
      case 'Substaint': return `__bí(${this.slonn(e.abhar)})`;   // tá / bhfuil alike

      // §5.11 — `tá Earráid ar thoradh`. The backend learns nothing: an
      // affliction is a value carrying a tag, and `__is` already reads tags.
      // Nothing at run time knows that the tag was reached through `ar`
      // rather than through the copula, which is the same erasure §6 got.
      case 'Dochar': return `__is(${this.slonn(e.abhar)}, ${JSON.stringify(e.cineal.ainm)})`;

      // §7.6 — `faigh Duine as stór`. The whole of the backend's knowledge of
      // the feature: a table name, a column list, and a tag. The marker itself
      // emits nothing — a `stór` struct compiles to exactly the same thing an
      // ordinary one does — and the query language stayed in `rt/stór.js`,
      // which is what keeps driver vocabulary out of this file. No constructor
      // is named, because an imported type's constructor is not in scope here
      // and the tag is all `__is` ever wanted.
      case 'Faigh': {
        const t = e.cineálStoir;
        const colúin = t.stor.reimsi.map((r) => JSON.stringify(r)).join(', ');
        return `${this.slonn(e.foinse)}.faigh(${JSON.stringify(t.stor.tabla)}, `
             + `[${colúin}], ${JSON.stringify(t.ainm)})`;
      }

      case 'Críoch': return `(await ${this.slonn(e.abhar)})`;

      case 'Má': {
        if (this.simpli(e)) return this.máTéarnach(e);
        const t = this.sealadach();
        this.líne(`let ${t};`);
        this.máRáiteas(e, t);
        return t;
      }

      case 'Ainmniú':
        return e.ceangal ? e.ceangal.jsAinm : e.surface;

      default:
        throw new Error(`slonn anaithnid sa chúlchríoch: ${e.cineál}`);
    }
  }
}

function gin(ast) { return new Ginteoir().clar(ast); }

module.exports = { gin };
