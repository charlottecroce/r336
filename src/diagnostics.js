'use strict';

/*
 * fáiltis.js — diagnostics.
 *
 * Messages are Irish. Codes are stable so that tests and tooling survive
 * rewording (§27). The prose should still be reviewed by a fluent speaker;
 * the codes are the contract, the wording is not yet.
 *
 * Ranges:
 *   1xx  moirfeolaíocht  — mutation, grammatical form, resolution
 *   2xx  cineálacha      — types
 *   3xx  copail / bí     — classification and existence
 *   4xx  comhréir        — lexing and parsing
 *   5xx  modh agus aspect— imperative vs indicative, ongoing vs completed
 */

const { reamhlitirH } = require('./morphology');

class Earraid extends Error {
  constructor(cod, teachtaireacht, ionad) {
    super(`${cod} ${ionad ? `[${ionad.comhad}:${ionad.line}:${ionad.col}] ` : ''}${teachtaireacht}`);
    this.name = 'Earráid';
    this.cod = cod;
    this.teachtaireacht = teachtaireacht;
    this.ionad = ionad || null;
  }
}

class Cnuasach extends Error {
  constructor(earraidi) {
    super(earraidi.map((e) => e.message).join('\n'));
    this.name = 'Earráidí';
    this.earraidi = earraidi;
  }
}

/** Reasons a word cannot be lenited, rendered as Irish clauses. */
const CUISEANNA = {
  'guta': 'tosaíonn sé le guta',
  'lnrh': 'tosaíonn sé le l, n, r nó h',
  'cnuasach-s': 'tosaíonn sé le cnuasach s + consan',
  'seimhithe-cheana': 'tá séimhiú air cheana',
  'neamhlitir': 'ní tosaíonn sé le consan inséimhithe',
  'folamh': 'tá sé folamh',
};

const M = {
  // ── 1xx: moirfeolaíocht ───────────────────────────────────────────────
  E101: (ainm) => `Aitheantóir gan sainmhíniú: "${ainm}".`,

  E102: (surface, ceart, oibreoir) =>
    `Ní mór séimhiú a chur ar an aitheantóir "${surface}" i ndiaidh "${oibreoir}". Úsáid "${ceart}".`,

  E103: (surface, ceart) =>
    `Séimhiú gan údar ar "${surface}": níl an suíomh seo á rialú ag oibreoir séimhithe. Úsáid an bhunfhoirm "${ceart}".`,

  E104: (lemma, cuis) =>
    `Ní féidir an t-aitheantóir "${lemma}" a shéimhiú (${CUISEANNA[cuis] || cuis}); is í an bhunfhoirm an t-aon fhoirm atá aige.`,

  E105: (surface, lemma, ceart) =>
    `Níl an fhoirm "${surface}" bailí don aitheantóir "${lemma}". An fhoirm a bhí ag teastáil: "${ceart}".`,

  E107: (surface, ceart) =>
    `Ní mór aitheantóirí a fhógairt sa bhunfhoirm. Fógraíodh "${surface}"; úsáid "${ceart}".`,

  E108: (ainm) => `Níl urú curtha i bhfeidhm sa teanga fós: "${ainm}".`,

  // ── 2xx: cineálacha ───────────────────────────────────────────────────
  // `le` prefixes h- to a vowel-initial word (le hUimhir, le Teaghrán), so
  // the formatter runs the same morphology the language does.
  E201: (suil, fuarthas) =>
    `Neamhréir chineáil: ag súil le ${reamhlitirH(suil)}, fuarthas ${fuarthas}.`,

  E202: (ainm) => `Cineál anaithnid: "${ainm}".`,

  E203: (reimse, struchtur) => `Níl an réimse "${reimse}" sa struchtúr "${struchtur}".`,

  E204: (struchtur, reimsi) =>
    `Réimsí ar iarraidh sa struchtúr "${struchtur}": ${reimsi.map((r) => `"${r}"`).join(', ')}.`,

  E205: (cineal) => `Ní féidir "ó" a úsáid ar rud de chineál ${cineal}.`,

  E206: (ainm, suil, fuarthas) =>
    `Tá ${suil} argóint ag teastáil ó "${ainm}", ach fuarthas ${fuarthas}.`,

  E207: (cineal) => `Ní feidhm é seo (cineál: ${cineal}); ní féidir é a ghlaoch.`,

  E208: (ainm) => `Tá an t-aitheantóir "${ainm}" ceangailte cheana féin sa scóip seo.`,

  E209: (ainm, suil, fuarthas) =>
    `Tugann an fheidhm "${ainm}" ${fuarthas} ar ais, ach ${suil} atá geallta aici.`,

  E210: (op, ar, dheis) => `Ní féidir "${op}" a chur i bhfeidhm ar ${ar} agus ${dheis}.`,

  // Curtha in áirithe go dtí go mbeidh cineálacha suime ann; leathnaítear
  // liosta ilchineálach go Liosta(Iasacht) faoi láthair.
  E211: (a, b) => `Ní mór an cineál céanna a bheith ag gach mír i liosta: ${a} agus ${b}.`,

  E212: (ainm, suil, fuarthas) =>
    `Tá ${suil} paraiméadar cineáil ag "${ainm}", ach fuarthas ${fuarthas}.`,

  // ── 3xx: copail agus briathar substaintigh ────────────────────────────
  E301: () => `Ní mór gur cineál atá ar dheis na copaile "is".`,

  // Curtha in áirithe: aicmiú nach féidir a bheith fíor go statach.
  E302: (cineal, cineal2) => `Ní féidir le rud de chineál ${cineal} bheith ina ${cineal2} choíche.`,

  // ── 4xx: comhréir ─────────────────────────────────────────────────────
  E401: (fuarthas, suil) => `Comhartha gan choinne: fuarthas ${fuarthas}, ag súil le ${suil}.`,
  E402: (ch) => `Carachtar anaithnid sa fhoinse: ${ch}.`,
  E403: () => `Teaghrán gan dúnadh.`,
  E404: () => `Ní ghlacann gníomh le cineál toraidh: ní thugann ordú aon rud ar ais.`,

  // ── 5xx: modh agus aspect ─────────────────────────────────────────────
  E501: (ainm) =>
    `Is gníomh é "${ainm}", ní ainmní: ní féidir ordú a úsáid mar shlonn. Tabhair mar ordú é.`,

  E502: (ainm) =>
    `Ordú "${ainm}" taobh istigh d'fheidhm. Ní dhéanann feidhm gníomh; bain úsáid as "gníomh".`,

  E503: () =>
    `Luach á chaitheamh i dtraipisí taobh istigh d'fheidhm. Sa mhodh táscach luaitear rudaí; sa mhodh ordaitheach a dhéantar iad.`,

  E504: () =>
    `"tar éis" gan "ag": ní féidir gníomh a chríochnú mura bhfuil sé ar siúl. Cuir "ag" roimh an bhfógra.`,

  E505: (cineal) =>
    `Gníomh atá ar siúl (${cineal}) á úsáid mar luach. Úsáid "tar éis" chun é a chríochnú.`,

  // Curtha in áirithe: ardaíonn an chúlchríoch craobhacha ilráiteacha anois.
  E506: () => `Ní féidir "má" a úsáid mar shlonn ach nuair a thugann gach craobh luach.`,

  E507: () =>
    `Slabhra "má" gan chríoch: teastaíonn craobh "mura" lom uaidh chun luach a thabhairt i gcónaí.`,

  E508: (cineal) => `Níl aon rud le críochnú anseo: ní gníomh ar siúl é ${cineal}.`,

  E509: (ainm) => `Ní féidir modh a fhógairt ar rud nach struchtúr é: "${ainm}".`,

  E510: (ainm) =>
    `Tá "${ainm}" seasmhach: ní féidir staid a chur air. Fógair le "sealadach" é más rud é atá le hathrú.`,

  E511: () => `Ní sprioc bhailí do "cuir … ar" é seo: teastaíonn ceangal nó réimse.`,

  E512: (surface, ceart, rialu) =>
    `Foirm mhícheart den bhriathar substaintigh: scríobhadh "${surface}", ach is í an fhoirm ${rialu} "${ceart}" atá ag teastáil sa suíomh seo.`,

  E513: (ainm) =>
    `Ní briathar é "${ainm}": ní féidir "a" a chur roimh rud nach féidir a ainmniú.`,
};

function earraid(cod, ionad, ...args) {
  const f = M[cod];
  if (!f) throw new Error(`cód anaithnid: ${cod}`);
  return new Earraid(cod, f(...args), ionad);
}

/** Collects errors so one compile reports many problems. */
class Bailitheoir {
  constructor() { this.earraidi = []; }
  cuir(cod, ionad, ...args) { this.earraidi.push(earraid(cod, ionad, ...args)); return null; }
  get folamh() { return this.earraidi.length === 0; }
  caith() { if (!this.folamh) throw new Cnuasach(this.earraidi); }
}

module.exports = { Earraid, Cnuasach, earraid, Bailitheoir, CUISEANNA };
