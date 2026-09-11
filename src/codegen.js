'use strict';

// cúlchríoch.js — the JavaScript backend.
//
// By here, morphology is gone: `dhuine` was resolved to lemma `duine` in the
// analyzer, so the emitter only ever sees lemmas. Mood/aspect are gone too:
// an imperative is a plain function, `ag` is `async`, `tar éis` is `await`,
// and a method is a top-level function taking its receiver first (dispatched
// statically since the analyzer already knew the possessor's category).
// `tá`/`bhfuil` both emit `__bí` — the alternation is agreement, not meaning.

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
// §7.6.6 — an empty list has no way to say "or not" for a bare Uimhir, so
// \`céad\` on an empty list throws rather than silently returning undefined
// wearing a declared type.
function __céad(liosta) {
  if (!liosta.length) throw new Error("céad: liosta folamh");
  return liosta[0];
}
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
    for (const [foinse, ailias] of (ast.ailiasanna || new Map())) {
      this.líne(`const ${ailias} = require(${JSON.stringify(conair(foinse))});`);
    }
    for (const m of ast.mireanna) {
      // Provenance is decided entirely front-end and emits nothing. No
      // __contae on instances: nothing at runtime asks a value its county.
      if (m.cineál === 'Contae' || m.cineál === 'Comhaontú') continue;
      if (m.cineál === 'Struchtúr') { this.struchtur(m); onnmhairi.push(`${m.ainm}$nua`); continue; }
      if (m.cineál === 'Suim') {
        // The sum itself emits nothing (a statement about which tags are
        // possible has no runtime shadow). Each variant gets a struct-style
        // tagging constructor.
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
        // §7.6 — `cuir duine i stór`: table name, column list, value. No
        // tag on the write side (the column list says what to read off the
        // value); `faigh` passes one because `__is` wants it coming back in.
        if (r.reamhfhocal === 'i') {
          const t = r.cineálStoir;
          const colúin = t.stor.reimsi.map((c) => JSON.stringify(c)).join(', ');
          return this.líne(`${r.leanunach ? 'await ' : ''}${this.slonn(r.stor)}`
            + `.cuir(${JSON.stringify(t.stor.tabla)}, [${colúin}], ${luach});`);
        }
        return this.líne(`${this.slonn(r.sprioc)} = ${luach};`);
      }

      case 'Má':
        return this.máRáiteas(r, null);

      case 'Ordú': {
        // `déan a fhógair ar dhaoine` — for…of rather than forEach, since an
        // ongoing verb must await in sequence and R336 has no closures.
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
        throw new Error(`ráiteas anaithnid: ${r.cineál}`);
    }
  }

  /** `má`/`mura` as a statement, or assigning into `sprioc` as an expression. */
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

      // The grammatical possessive relation collapses to a property read.
      case 'Sealbhach': {
        const sealbh = this.slonn(e.sealbhoir);
        if (e.ionsuite === 'fad') return `${sealbh}.length`;
        if (e.ionsuite === 'folamh') return `(${sealbh}.length === 0)`;
        if (e.ionsuite === 'céad') return `__céad(${sealbh})`;
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

      // §5.11 — an affliction is a value carrying a tag; `__is` already
      // reads tags, so nothing distinguishes this from the copula path.
      case 'Dochar': return `__is(${this.slonn(e.abhar)}, ${JSON.stringify(e.cineal.ainm)})`;

      // §7.6 — `faigh Duine as stór`. Table name, column list, tag. No
      // constructor: an imported type's `$nua` isn't in scope here.
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