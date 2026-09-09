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
 *   6xx  dúchas          — province, county, exile, treaty (§24, §25)
 */

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

/** Reasons a word cannot be lenited, rendered as Irish clauses. */
const CUISEANNA = {
  'guta': 'tosaíonn sé le guta',
  'lnrh': 'tosaíonn sé le l, n, r nó h',
  'cnuasach-s': 'tosaíonn sé le cnuasach s + consan',
  'seimhithe-cheana': 'tá séimhiú air cheana',
  'neamhlitir': 'ní tosaíonn sé le consan inséimhithe',
  'folamh': 'tá sé folamh',
};

/**
 * A place, named the way the reader needs it in a 6xx message.
 *
 * Since 0.7 the border compares provinces, so a message that names only
 * counties is not saying why it fired: *as Corcaigh* against *as Gaillimh*
 * is refused for a reason a reader cannot see unless the message says
 * "An Mhumhain" and "Connachta". Exile has no province and gets no
 * parenthesis, because "deoraíocht (deoraíocht)" says nothing twice.
 */
const ait = (c) => (c === ctae.DEORAIOCHT ? c : `${c} (${ctae.cuigeDe(c)})`);

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

  // Onnmhairíonn níos mó ná modúl amháin an lemma céanna: ní féidir a rá cé
  // acu briathar atá i gceist gan cháiliú, agus ní cháilítear briathra.
  E106: (ainm, foinsi) =>
    `Tá "${ainm}" á onnmhairiú ag níos mó ná modúl amháin (${foinsi.map((f) => `"${f}"`).join(', ')}). Athainmnigh ceann acu.`,

  E107: (surface, ceart) =>
    `Ní mór aitheantóirí a fhógairt sa bhunfhoirm. Fógraíodh "${surface}"; úsáid "${ceart}".`,

  E108: (ainm) => `Níl urú curtha i bhfeidhm sa teanga fós: "${ainm}".`,

  E109: (conair) => `Ní bhfuarthas an modúl "${conair}".`,

  E110: (timthriall) =>
    `Timthriall i measc na modúl: ${timthriall.join(' → ')}. Ní féidir modúl a thiomsú roimhe féin.`,

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

  // Réamhfhocal an bhriathair: roghnaíonn briathar réamhfhocal ar leith, agus
  // ní ghlactar le frása gan é ná le frása mícheart.
  E514: (ainm, reamhfhocal) =>
    `Tá frása "${reamhfhocal}" ag teastáil ón ordú "${ainm}": is é sin an réamhfhocal a roghnaíonn an briathar seo.`,

  E515: (ainm) =>
    `Ní ghlacann an t-ordú "${ainm}" le frásaí réamhfhoclacha.`,

  // Tógann `ó` frása ainmfhoclach, agus ní ainmní é ordú (E501). Tagann
  // briathar iasachta isteach sa fhoclóir gan cháiliú, mar a thagann i
  // nGaeilge: ní deirtear "an briathar iasachta X", ach X.
  E516: (ainm) =>
    `Ní ghlacann an t-ordú "${ainm}" le sealbhóir: tógann "ó" frása ainmfhoclach, agus ní ainmní é ordú. Tá briathar iasachta san fhoclóir gan cháiliú — tabhair "${ainm} …" mar ordú.`,

  // ── 6xx: dúchas ───────────────────────────────────────────────────────
  // A new axis, alongside morphology, types, the copula, syntax and mood.
  // The county system is a bit and the notes say so (§24.1, §25.1); the
  // diagnostics are not, and they hold to the same standard as the rest.
  //
  // Three of these are funny, and none of them is written to be. The rule is
  // the joke; the message states the rule.

  // Modelled on E103 and E205 — what was found, what was demanded, and why.
  // Since 0.7 the comparison is between provinces, so both places are named
  // with theirs or the message does not say why it fired.
  E601: (ball, contaeBaill, contaeAitiuil) =>
    `Níl cead ag téacs as ${ait(contaeAitiuil)} an ball "${ball}" a oscailt: is as ${ait(contaeBaill)} é, agus níl aon chomhaontú eatarthu.`,

  E602: (ainm) =>
    `Níl "${ainm}" ar cheann de na 32 contae.`,

  // Three things named, because the author needs all three to fix it: the
  // province that is gone, the county sitting in it, and the struct that put
  // it there. Naming only the county — which is what 0.6 did — is now wrong,
  // because the thing that was taken is not the county that was written.
  E603: (cuige, contae, struchtur) =>
    `Tá ${cuige} tógtha cheana ag an struchtúr "${struchtur}", atá as ${contae}. Ní bhíonn ach struchtúr amháin ag cúige: ceithre chineál churtha atá i gclár, agus is ionann contae a roghnú agus cúige a roghnú.`,

  E604: () =>
    `Tá contae an mhodúil fógartha faoi dhó. Ní bhíonn téacs as dhá áit.`,

  E605: () =>
    `Ní áit í an deoraíocht, ach an rud a bhíonn ann nuair nach bhfógraítear áit ar bith: ní féidir í a fhógairt, ná comhaontú a dhéanamh léi.`,

  E606: (contae) =>
    `Ní dhéantar comhaontú le duine féin: tá ${contae} luaite faoi dhó.`,

  E607: (a, b) =>
    `Tá comhaontú idir ${a} agus ${b} sa chomhad seo cheana. Is ionann comhaontú ón dá thaobh, mar sin níl san dara fógra ach athrá.`,

  // §25.4 — an t-iompú. Ní eisceacht sa tábla comhaontuithe é seo: ní
  // fhéadfadh comhaontú idir iomaitheoirí cead a thabhairt riamh, mar go
  // ritheann an cosc roimh an gcuardach. Insítear anseo é san áit a
  // gceapann an t-údar go bhfuil leigheas ann.
  E608: (a, b) =>
    `Ní dhéantar comhaontú idir ${a} agus ${b}: is seanaighneas atá eatarthu. Níl aon leigheas air.`,

  // The last clause is the whole rule and is meant flatly: the province does
  // not help. Two rivals in one province are still two rivals.
  E609: (ball, contaeBaill, contaeAitiuil) =>
    `Níl cead ag téacs as ${contaeAitiuil} an ball "${ball}" a oscailt: is as ${contaeBaill} é, agus is seanaighneas atá eatarthu. Ní réitíonn comhaontú é seo (E608), ná an cúige céanna.`,
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
