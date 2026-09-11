'use strict';

// fáiltis.js — diagnostics.
//
// Messages are Irish. Codes are stable so tests/tooling survive rewording;
// the prose is not yet reviewed by a fluent speaker.
//
// Ranges:
//   1xx  moirfeolaíocht  — mutation, form, resolution
//   2xx  cineálacha      — types
//   3xx  copail / bí     — classification and existence
//   4xx  comhréir        — lexing and parsing
//   5xx  modh agus aspect— mood, aspect
//   6xx  dúchas          — province, county, exile, treaty

const { reamhlitirH } = require('./morphology');
const ctae = require('./contaetha');

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

/** Reasons a word cannot be lenited, as Irish clauses. */
const CUISEANNA = {
  'guta': 'tosaíonn sé le guta',
  'lnrh': 'tosaíonn sé le l, n, r nó h',
  'cnuasach-s': 'tosaíonn sé le cnuasach s + consan',
  'seimhithe-cheana': 'tá séimhiú air cheana',
  'neamhlitir': 'ní tosaíonn sé le consan inséimhithe',
  'folamh': 'tá sé folamh',
  'gan-uru': 'ní tosaíonn sé le consan in-uraithe ná le guta',
  'uraithe-cheana': 'tá urú air cheana',
};

/** A place formatted with its province, since the border compares provinces. */
const ait = (c) => (c === ctae.DEORAIOCHT ? c : `${c} (${ctae.cuigeDe(c)})`);

const M = {
  // ── 1xx: moirfeolaíocht ──
  E101: (ainm) => `Aitheantóir gan sainmhíniú: "${ainm}".`,

  E102: (surface, ceart, oibreoir) =>
    `Ní mór séimhiú a chur ar an aitheantóir "${surface}" i ndiaidh "${oibreoir}". Úsáid "${ceart}".`,

  E103: (surface, ceart) =>
    `Séimhiú gan údar ar "${surface}": níl an suíomh seo á rialú ag oibreoir séimhithe. Úsáid an bhunfhoirm "${ceart}".`,

  E104: (lemma, cuis) =>
    `Ní féidir an t-aitheantóir "${lemma}" a shéimhiú (${CUISEANNA[cuis] || cuis}); is í an bhunfhoirm an t-aon fhoirm atá aige.`,

  E105: (surface, lemma, ceart) =>
    `Níl an fhoirm "${surface}" bailí don aitheantóir "${lemma}". An fhoirm a bhí ag teastáil: "${ceart}".`,

  E106: (ainm, foinsi) =>
    `Tá "${ainm}" á onnmhairiú ag níos mó ná modúl amháin (${foinsi.map((f) => `"${f}"`).join(', ')}). Athainmnigh ceann acu.`,

  E107: (surface, ceart) =>
    `Ní mór aitheantóirí a fhógairt sa bhunfhoirm. Fógraíodh "${surface}"; úsáid "${ceart}".`,

  // Reserved since 0.13: `i` gave eclipsis a slot, so an eclipsed form now
  // resolves (E113 if unlicensed) instead of being refused by name here.
  E108: (ainm) => `Níl urú curtha i bhfeidhm sa teanga fós: "${ainm}".`,

  E109: (conair) => `Ní bhfuarthas an modúl "${conair}".`,

  E110: (timthriall) =>
    `Timthriall i measc na modúl: ${timthriall.join(' → ')}. Ní féidir modúl a thiomsú roimhe féin.`,

  // §5.2, 0.13 — urú, mirroring E102/E103/E104 for eclipsis instead of
  // lenition. E111 is different: not a mutation fault but the wrong
  // preposition allomorph (i vs in).
  E111: (scriofa, ceart, focal) =>
    `Foirm mhícheart den réamhfhocal: scríobhadh "${scriofa}", ach is é "${ceart}" atá ag teastáil roimh "${focal}".`,

  E112: (surface, ceart, oibreoir) =>
    `Ní mór urú a chur ar an aitheantóir "${surface}" i ndiaidh "${oibreoir}". Úsáid "${ceart}".`,

  E113: (surface, ceart) =>
    `Urú gan údar ar "${surface}": níl an suíomh seo á rialú ag oibreoir uraithe. Úsáid an bhunfhoirm "${ceart}".`,

  E114: (lemma, cuis) =>
    `Ní féidir urú a chur ar an aitheantóir "${lemma}" (${CUISEANNA[cuis] || cuis}); is í an bhunfhoirm an t-aon fhoirm atá aige.`,

  // ── 2xx: cineálacha ──
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

  // Reserved. Two sum variants meet at the sum instead of widening; a list
  // that doesn't meet anywhere still widens to Liosta(Iasacht), because a
  // driver's variadic param list is legitimately heterogeneous.
  E211: (a, b) => `Ní mór an cineál céanna a bheith ag gach mír i liosta: ${a} agus ${b}.`,

  E212: (ainm, suil, fuarthas) =>
    `Tá ${suil} paraiméadar cineáil ag "${ainm}", ach fuarthas ${fuarthas}.`,

  // A sum declares exactly what a value may be; Iasacht ("unknown category")
  // inside a variant field contradicts that. Struct fields may still be
  // Iasacht — a record never claimed to enumerate anything.
  E213: (suim, malairt, reimse, cineal) =>
    `Ní féidir le réimse malairte a bheith ina ${cineal}: tá "${reimse}" sa mhalairt "${malairt}" den tsuim "${suim}". Dearbhaíonn suim cad is féidir le luach a bheith, agus ní catagóir í an Iasacht. Tiontaigh ar an teorainn é.`,

  E214: (ainm, lion) =>
    `Ní suim í "${ainm}": ${lion === 0 ? 'níl malairt ar bith inti' : 'níl inti ach malairt amháin'}. Ní mór dhá cheann ar a laghad a bheith i suim, mar is é rogha idir catagóirí an t-aon rud a dhearbhaíonn sí.`,

  // ── 3xx: copail agus briathar substaintigh ──
  E301: () => `Ní mór gur cineál atá ar dheis na copaile "is".`,

  // Reachable since a sum closes what a value may be, so classification can
  // be disproved statically.
  E302: (cineal, cineal2) => `Ní féidir le rud de chineál ${cineal} bheith ina ${cineal2} choíche.`,

  // ── 4xx: comhréir ──
  E401: (fuarthas, suil) => `Comhartha gan choinne: fuarthas ${fuarthas}, ag súil le ${suil}.`,
  E402: (ch) => `Carachtar anaithnid sa fhoinse: ${ch}.`,
  E403: () => `Teaghrán gan dúnadh.`,
  E404: () => `Ní ghlacann gníomh le cineál toraidh: ní thugann ordú aon rud ar ais.`,

  // ── 5xx: modh agus aspect ──
  E501: (ainm) =>
    `Is gníomh é "${ainm}", ní ainmní: ní féidir ordú a úsáid mar shlonn. Tabhair mar ordú é.`,

  E502: (ainm) =>
    `Ordú "${ainm}" taobh istigh d'fheidhm. Ní dhéanann feidhm gníomh; bain úsáid as "gníomh".`,

  E503: () =>
    `Luach á chaitheamh i dtraipisí taobh istigh d'fheidhm. Sa mhodh táscach luaitear rudaí; sa mhodh ordaitheach a dhéantar iad.`,

  // Covers `cuir … i …` too since 0.13 — same fault, ongoing action without `ag`.
  E504: () =>
    `Gníomh ar siúl gan "ag": ní féidir gníomh a chríochnú ná a chur i gcrích mura bhfuil an fógra ar siúl. Cuir "ag" roimh an bhfógra.`,

  E505: (cineal) =>
    `Gníomh atá ar siúl (${cineal}) á úsáid mar luach. Úsáid "tar éis" chun é a chríochnú.`,

  // Reserved: multi-statement `má` branches are now hoisted by codegen, so
  // "má" as an expression no longer fails this way.
  E506: () => `Ní féidir "má" a úsáid mar shlonn ach nuair a thugann gach craobh luach.`,

  E507: () =>
    `Slabhra "má" gan chríoch: teastaíonn craobh "mura" lom uaidh chun luach a thabhairt i gcónaí.`,

  E508: (cineal) => `Níl aon rud le críochnú anseo: ní gníomh ar siúl é ${cineal}.`,

  E509: (ainm) => `Ní féidir modh a fhógairt ar rud nach struchtúr é firinscneach: "${ainm}".`,

  E510: (ainm) =>
    `Tá "${ainm}" seasmhach: ní féidir staid a chur air. Fógair le "sealadach" é más rud é atá le hathrú.`,

  E511: (fras) => (fras === 'i'
    ? `Ní sprioc bhailí do "cuir … i" é seo: teastaíonn aitheantóir a ainmníonn stór.`
    : `Ní sprioc bhailí do "cuir … ar" é seo: teastaíonn ceangal nó réimse.`),

  E512: (surface, ceart, rialu) =>
    `Foirm mhícheart den bhriathar substaintigh: scríobhadh "${surface}", ach is í an fhoirm ${rialu} "${ceart}" atá ag teastáil sa suíomh seo.`,

  E513: (ainm) =>
    `Ní briathar é "${ainm}": ní féidir "a" a chur roimh rud nach féidir a ainmniú.`,

  E514: (ainm, reamhfhocal) =>
    `Tá frása "${reamhfhocal}" ag teastáil ón ordú "${ainm}": is é sin an réamhfhocal a roghnaíonn an briathar seo.`,

  E515: (ainm) =>
    `Ní ghlacann an t-ordú "${ainm}" le frásaí réamhfhoclacha.`,

  E516: (ainm) =>
    `Ní ghlacann an t-ordú "${ainm}" le sealbhóir: tógann "ó" frása ainmfhoclach, agus ní ainmní é ordú. Tá briathar iasachta san fhoclóir gan cháiliú — tabhair "${ainm} …" mar ordú.`,

  // §8 — the form doesn't allow this, it's not a policy carve-out.
  E518: (ainm, saor) =>
    `Ní ordaítear do bhriathar saor: is é "${ainm}" fréamh an bhriathair, agus is í an fhréamh an modh ordaitheach — labhraíonn sí le déantóir. Níl déantóir ag "${ainm}". Scríobh "${saor} …" mar ráiteas, nó tabhair "a ${ainm}" do rud éigin lasmuigh a dhéanfaidh é.`,

  E519: (surface, ceart, lemma) =>
    `Foirm mhícheart den bhriathar saor: scríobhadh "${surface}", ach is í "${ceart}" foirm shaor "${lemma}". Ní athraíonn an fhoirm shaor an bhrí; ní deir sí ach nach luaitear an déantóir.`,

  E520: (ainm) =>
    `Ní ghlacann briathar saor le faighteoir: ní chuireann an fhoirm shaor déantóir in iúl, agus is déantóir é "féin". Fógair "${ainm}" gan frása "ó".`,

  E521: (ainm, cuis) =>
    `Ní féidir foirm shaor a dhéanamh de "${ainm}" (${cuis === 'gan-ghuta' ? 'níl guta ann' : cuis}): ní réimnítear focal nach bhfuil ina fhréamh bhriathair.`,

  E517: (scriofa, ceart) =>
    `Foirm mhícheart den chopail: scríobhadh "${scriofa}", ach is í "${ceart}" an fhoirm atá ag teastáil sa suíomh seo. Ceanglaíonn an chopail leis an mír a rialaíonn í, agus roghnaíonn tús an chineáil ina diaidh an fhoirm.`,

  // §5.11 — the "misfortune" pattern (tá tinneas cinn orm). No new
  // morphology: `ar` already lenites and routes through reitighFoirm.
  E522: (ainm) =>
    `Ní chuirtear dochar ar rud nach bhfuil ann: níl toradh ar bith ag "${ainm}", mar sin níl aon rud ann le bheith buailte. Níl frása "ar" ceadaithe ach ar fheidhm a bhfuil "->" aici.`,

  E523: (dochar, toradh) =>
    `Tá ${dochar} air seo go fóill: ní ${toradh} é go dtí go bhfuil an dochar curtha as an áireamh. Scríobh "má tá ${dochar} ar …" agus úsáid é sa chraobh dhiúltach.`,

  E525: (cineal) =>
    `Ní dochar é ${cineal}: ainmníonn *tá tinneas cinn orm* galar, agus ní mí-ádh í uimhir lom. Caithfidh an rud a bhuaileann tú a bheith ina chineál fógartha a bhfuil cúis ann le rá aige.`,

  E524: (dochar, cineal) =>
    `Ní bhuailtear ${cineal} le ${dochar}: níor fhógair aon bhriathar an dochar sin air, mar sin tá an cheist gan bhrí. Ní cheistítear ach an rud a d'fhéadfadh a bheith buailte.`,

  // §5.10 — gender carries no meaning, only form.
  E526: (ainm, scriofa, ceart, dearbhaithe) =>
    `Ní réitíonn foirm na haidiachta leis an rud a fhógraíonn sí: scríobhadh "${scriofa}" i ndiaidh "${ainm}", ach is í "${ceart}" an fhoirm a éilíonn ainm ${dearbhaithe}. Aidiacht atá san fhógra, agus réitíonn aidiacht lena hainmfhocal.`,

  E527: (ainm, roimhe, ceart, line) =>
    `Is ainm ${roimhe} é "${ainm}" (líne ${line}), mar sin is í "${ceart}" an fhoirm atá ag teastáil anseo. Ní athraíonn focal a inscne idir dhá abairt den téacs céanna.`,

  // ── 6xx: dúchas ──
  // The county system is a deliberate bit; these diagnostics hold to the
  // same standard as everything else regardless.
  E601: (ball, contaeBaill, contaeAitiuil) =>
    `Níl cead ag téacs as ${ait(contaeAitiuil)} an ball "${ball}" a oscailt: is as ${ait(contaeBaill)} é, agus níl aon chomhaontú eatarthu.`,

  E602: (ainm) =>
    `Níl "${ainm}" ar cheann de na 32 contae.`,

  // Names all three so the author can fix it: the province taken, the
  // county sitting in it, and the type that put it there.
  E603: (cuige, contae, struchtur) =>
    `Tá ${cuige} tógtha cheana ag an gcineál "${struchtur}", atá as ${contae}. Éilíonn gnáthchineál curtha cúige iomlán, agus is ionann contae a roghnú agus cúige a roghnú. Ní éilíonn cineál stóir ach contae amháin (E612) — ach ní sháraíonn sin éileamh cúige atá ann cheana, ná a mhalairt.`,

  E604: () =>
    `Tá contae an mhodúil fógartha faoi dhó. Ní bhíonn téacs as dhá áit.`,

  E605: () =>
    `Ní áit í an deoraíocht, ach an rud a bhíonn ann nuair nach bhfógraítear áit ar bith: ní féidir í a fhógairt, ná comhaontú a dhéanamh léi.`,

  E606: (contae) =>
    `Ní dhéantar comhaontú le duine féin: tá ${contae} luaite faoi dhó.`,

  E607: (a, b) =>
    `Tá comhaontú idir ${a} agus ${b} sa chomhad seo cheana. Is ionann comhaontú ón dá thaobh, mar sin níl san dara fógra ach athrá.`,

  E608: (a, b) =>
    `Ní dhéantar comhaontú idir ${a} agus ${b}: is seanaighneas atá eatarthu. Níl aon leigheas air.`,

  E609: (ball, contaeBaill, contaeAitiuil) =>
    `Níl cead ag téacs as ${contaeAitiuil} an ball "${ball}" a oscailt: is as ${contaeBaill} é, agus is seanaighneas atá eatarthu. Ní réitíonn comhaontú é seo (E608), ná an cúige céanna.`,

  // §7.6 — table placement. No code for "two tables in one county" separately
  // since that's already two placed types in one province (E603).
  E610: (ainm) =>
    `Níl contae ag "${ainm}", agus bíonn tábla in áit éigin. Ní áit í an deoraíocht: cuir "as <contae>" leis an dearbhú, nó bain an marc "stór" de. Éilíonn cineál curtha cúige iomlán, agus níl ann ach ceithre cinn.`,

  E611: (ainm) =>
    `Níl tábla ag "${ainm}". Ní thugtar liosta folamh ar ais: dá bhfreagrófaí an cheist do chineál nár dhearbhaigh ceann, ní bheadh brí ar bith leis an dearbhú. Cuir "stór" le dearbhú "${ainm}".`,

  E612: (contae, struchtur) =>
    `Tá ${contae} tógtha cheana ag tábla an chineáil "${struchtur}". Ní bhíonn ach tábla amháin ag contae: dhá cheann is tríocha atá ann ar fad, agus ní bhaintear amach an líon sin ach i gclár nach bhfuil aon ghnáthchineál curtha ann.`,
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