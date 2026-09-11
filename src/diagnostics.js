'use strict';

/*
 * fáiltis.js — diagnostics.
 *
 * Messages are Irish. Codes are stable so that tests and tooling survive
 * rewording (§9). The prose should still be reviewed by a fluent speaker;
 * the codes are the contract, the wording is not yet.
 *
 * Ranges:
 *   1xx  moirfeolaíocht  — mutation, grammatical form, resolution
 *   2xx  cineálacha      — types
 *   3xx  copail / bí     — classification and existence
 *   4xx  comhréir        — lexing and parsing
 *   5xx  modh agus aspect— imperative vs indicative, ongoing vs completed
 *   6xx  dúchas          — province, county, exile, treaty (§7, §7)
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

  // Curtha in áirithe fós, agus ní mar a bhíothas ag súil. Buaileann dhá
  // mhalairt den tsuim chéanna le chéile ag an tsuim ó 0.8 i leith, ach
  // leathnaíonn liosta nach mbuaileann in aon áit go Liosta(Iasacht) mar a
  // rinne sé riamh: is liosta paraiméadar dlisteanach é `[ainm, aois]` ag an
  // teorainn, agus níor cheart suim a chumhdach air (§6).
  E211: (a, b) => `Ní mór an cineál céanna a bheith ag gach mír i liosta: ${a} agus ${b}.`,

  E212: (ainm, suil, fuarthas) =>
    `Tá ${suil} paraiméadar cineáil ag "${ainm}", ach fuarthas ${fuarthas}.`,

  // §6 — ní ceadmhach `Iasacht` i réimse malairte.
  //
  // Dearbhaíonn suim go beacht cad is féidir le luach a bheith; deir
  // `Iasacht` nach eol cén chatagóir í. Ualach de chatagóir anaithnid taobh
  // istigh d'áireamh catagóirí: sin suim nár críochnaíodh a scríobh. Ceadaítear
  // é fós i réimse struchtúir, mar nár mhaígh taifead riamh go n-áiríonn sé.
  E213: (suim, malairt, reimse, cineal) =>
    `Ní féidir le réimse malairte a bheith ina ${cineal}: tá "${reimse}" sa mhalairt "${malairt}" den tsuim "${suim}". Dearbhaíonn suim cad firinscneach is féidir le luach a bheith, agus ní catagóir í an Iasacht. Tiontaigh ar an teorainn é.`,

  // §6 — ní suim í suim nach bhfuil dhá mhalairt inti.
  //
  // Dhá chás, aon chód amháin, mar is ionann an locht iontu: ní dhéanann an
  // fógra rogha. Suim fholamh — níl luach ar bith inti, agus mar sin ní
  // cineál is féidir a lua í. Suim aonair — tá a fhios roimh ré cad í, agus
  // mar sin níl san eiliminéatóir ach deasghnáth: struchtúr a bhfuil `más`
  // éigeantach air. Luaitear a bhfuarthas, mar is é sin an rud atá le ceartú.
  E214: (ainm, lion) =>
    `Ní suim í firinscneach "${ainm}": ${lion === 0 ? 'níl malairt ar bith inti' : 'níl inti ach malairt amháin'}. Ní mór dhá cheann ar a laghad a bheith i suim, mar is é rogha idir catagóirí an t-aon rud a dhearbhaíonn sí.`,

  // ── 3xx: copail agus briathar substaintigh ────────────────────────────
  E301: () => `Ní mór gur cineál atá ar dheis na copaile "is".`,

  // Sroichte ó 0.8: dearbhaíonn suim go beacht cad is féidir le luach a
  // bheith, agus mar sin is féidir aicmiú a bhréagnú go statach. Ba é seo an
  // t-aon chód a bhí curtha in áirithe agus a d'éirigh fíor; níor thug an
  // nóta faoi deara é go dtí 0.10.1.
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

  // Curtha in áirithe, agus tá an chúis luaite in `test/earraidi.js` mar aon
  // leis na cinn eile: ardaíonn an chúlchríoch craobhacha ilráiteacha anois,
  // mar sin ní theipeann "má" mar shlonn ar an gcúis seo a thuilleadh.
  E506: () => `Ní féidir "má" a úsáid mar shlonn ach nuair a thugann gach craobh luach.`,

  E507: () =>
    `Slabhra "má" gan chríoch: teastaíonn craobh "mura" lom uaidh chun luach a thabhairt i gcónaí.`,

  E508: (cineal) => `Níl aon rud le críochnú anseo: ní gníomh ar siúl é ${cineal}.`,

  E509: (ainm) => `Ní féidir modh a fhógairt ar rud nach struchtúr é firinscneach: "${ainm}".`,

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

  // §8 — an briathar saor.
  //
  // Ní hionann é seo agus cosc: is é an fhoirm féin a dhiúltaíonn. Ordaítear
  // do dhuine, agus níl aon duine ann. Is é a mhalairt de E501 é — ní féidir
  // gníomh a lua, agus ní féidir briathar saor a ordú — agus insítear an dá
  // rud ar an gcaoi chéanna: cad é an rud, agus cad is féidir a dhéanamh leis.
  E518: (ainm, saor) =>
    `Ní ordaítear do bhriathar saor: is é "${ainm}" fréamh an bhriathair, agus is í an fhréamh an modh ordaitheach — labhraíonn sí le déantóir. Níl déantóir ag "${ainm}". Scríobh "${saor} …" mar ráiteas, nó tabhair "a ${ainm}" do rud éigin lasmuigh a dhéanfaidh é.`,

  E519: (surface, ceart, lemma) =>
    `Foirm mhícheart den bhriathar saor: scríobhadh "${surface}", ach is í "${ceart}" foirm shaor "${lemma}". Ní athraíonn an fhoirm shaor an bhrí; ní deir sí ach nach luaitear an déantóir.`,

  E520: (ainm) =>
    `Ní ghlacann briathar saor le faighteoir: ní chuireann an fhoirm shaor déantóir in iúl, agus is déantóir é "féin". Fógair "${ainm}" gan frása "ó".`,

  E521: (ainm, cuis) =>
    `Ní féidir foirm shaor a dhéanamh de "${ainm}" (${cuis === 'gan-ghuta' ? 'níl guta ann' : cuis}): ní réimnítear focal nach bhfuil ina fhréamh bhriathair.`,

  // §5.5 — foirm na copaile. An comhbhrá céanna le E512, ar an mír seachas ar
  // an mbriathar substaintigh: ceanglaíonn an chopail leis an mír a rialaíonn
  // í, agus roghnaíonn an chéad litir den chineál ina diaidh idir "mura" agus
  // "murab". Ní athraíonn a brí, díreach mar nach n-athraíonn brí "bhfuil".
  E517: (scriofa, ceart) =>
    `Foirm mhícheart den chopail: scríobhadh "${scriofa}", ach is í "${ceart}" an fhoirm atá ag teastáil sa suíomh seo. Ceanglaíonn an chopail leis an mír a rialaíonn í, agus roghnaíonn tús an chineáil ina diaidh an fhoirm.`,

  // §5.11 — `ar` mar staid dhochrach.
  //
  // Cuireann an Ghaeilge an mí-ádh ort: *tá tinneas cinn orm*, *theip orm*,
  // *tá brón orm*. Ní dhéanann an duine é agus ní leis é — tarlaíonn sé dó.
  // Sin an tríú ball den scoilt: `ag` coimeád, `le` teideal, `ar` dochar.
  //
  // Níl aon mhoirfeolaíocht nua anseo. Séimhíonn `ar` cheana agus téann sé
  // trí `reitighFoirm` cheana (§5.2, §5.8). Is í an bhrí atá nua, agus mar sin
  // caithfear a rá gur ar fhorais shéimeantacha atá an ghné seo bunaithe agus
  // ní ar fhorais ghramadaí — an chóireáil chéanna a fuair `suim` i §6.
  E522: (ainm) =>
    `Ní chuirtear dochar ar rud nach bhfuil ann: níl toradh ar bith ag "${ainm}", mar sin níl aon rud ann le bheith buailte. Níl frása "ar" ceadaithe ach ar fheidhm a bhfuil "->" aici.`,

  // An chosaint, agus níl sí ann ach san áit ar fhógair an briathar í. Sin an
  // difríocht idir seo agus cineál suime: ní iarrtar ar an nglaoiteoir gach
  // rud a scrúdú, ní iarrtar air ach an rud a dúradh leis a d'fhéadfadh a
  // bheith buailte.
  E523: (dochar, toradh) =>
    `Tá ${dochar} air seo go fóill: ní ${toradh} é go dtí go bhfuil an dochar curtha as an áireamh. Scríobh "má tá ${dochar} ar …" agus úsáid é sa chraobh dhiúltach.`,

  E525: (cineal) =>
    `Ní dochar é ${cineal}: ainmníonn *tá tinneas cinn orm* galar, agus ní mí-ádh í uimhir lom. Caithfidh an rud a bhuaileann tú a bheith ina chineál fógartha a bhfuil cúis ann le rá aige.`,

  E524: (dochar, cineal) =>
    `Ní bhuailtear ${cineal} le ${dochar}: níor fhógair aon bhriathar an dochar sin air, mar sin tá an cheist gan bhrí. Ní cheistítear ach an rud a d'fhéadfadh a bheith buailte.`,

  // §5.10 — inscne ghramadaí.
  //
  // Ní iompraíonn an inscne brí ar bith. Sin an difríocht idir seo agus an
  // rud ar dhiúltaigh §12 dó: theastaigh `aige`/`aici` ón úinéireacht chun
  // sealbhóir amháin a aithint thar cheann eile, agus b'shin catagóir
  // ghramadaí ag iompar ábhair a raibh an clár ag brath air. Ní éilíonn an
  // inscne anseo ach foirm, agus ní athraíonn sí rud ar bith eile.
  E526: (ainm, scriofa, ceart, dearbhaithe) =>
    `Ní réitíonn foirm na haidiachta leis an rud a fhógraíonn sí: scríobhadh "${scriofa}" i ndiaidh "${ainm}", ach is í "${ceart}" an fhoirm a éilíonn ainm ${dearbhaithe}. Aidiacht atá san fhógra, agus réitíonn aidiacht lena hainmfhocal.`,

  E527: (ainm, roimhe, ceart, line) =>
    `Is ainm ${roimhe} é "${ainm}" (líne ${line}), mar sin is í "${ceart}" an fhoirm atá ag teastáil anseo. Ní athraíonn focal a inscne idir dhá abairt den téacs céanna.`,

  // ── 6xx: dúchas ───────────────────────────────────────────────────────
  // A new axis, alongside morphology, types, the copula, syntax and mood.
  // The county system is a bit and the notes say so (§7.1, §7.1); the
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
  // Ó 0.8 i leith is féidir gur suim atá san áititheoir, mar tá suim agus
  // struchtúr san iomaíocht chéanna ar na ceithre shliotán (§6).
  //
  // (Bhí an nóta seo truaillithe ag imirce 0.11: cuireadh "firinscneach"
  // isteach trí huaire i lár na Gaeilge. Deisithe i 0.12 — féach §0.)
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

  // §7.2 — an t-iompú. Ní eisceacht sa tábla comhaontuithe é seo: ní
  // fhéadfadh comhaontú idir iomaitheoirí cead a thabhairt riamh, mar go
  // ritheann an cosc roimh an gcuardach. Insítear anseo é san áit a
  // gceapann an t-údar go bhfuil leigheas ann.
  E608: (a, b) =>
    `Ní dhéantar comhaontú idir ${a} agus ${b}: is seanaighneas atá eatarthu. Níl aon leigheas air.`,

  // The last clause is the whole rule and is meant flatly: the province does
  // not help. Two rivals in one province are still two rivals.
  E609: (ball, contaeBaill, contaeAitiuil) =>
    `Níl cead ag téacs as ${contaeAitiuil} an ball "${ball}" a oscailt: is as ${contaeBaill} é, agus is seanaighneas atá eatarthu. Ní réitíonn comhaontú é seo (E608), ná an cúige céanna.`,

  // ── §7.6: táblaí stóir ──────────────────────────────────────
  // Two codes, and the pair that is *not* here is worth naming: there is no
  // code for two tables in one county, because two placed types in one county
  // are two placed types in one province and E603 has already said so. A
  // second diagnostic would name the same fault twice.

  // Both ways out are named, because either may be the right one: the author
  // either meant the type to be somewhere, or did not mean it to have a table.
  E610: (ainm) =>
    `Níl contae ag "${ainm}", agus bíonn tábla in áit éigin. Ní áit í an deoraíocht: cuir "as <contae>" leis an dearbhú, nó bain an marc "stór" de. Éilíonn cineál curtha cúige iomlán, agus níl ann ach ceithre cinn.`,

  // A refusal and not a `liosta folamh`, on the E302 and E524 pattern: dá
  // bhfreagrófaí an cheist do chineál nár dhearbhaigh tábla, bheadh an
  // cheist ar fáil i gcónaí agus ní chiallódh an dearbhú faic.
  E611: (ainm) =>
    `Níl tábla ag "${ainm}". Ní thugtar liosta folamh ar ais: dá bhfreagrófaí an cheist do chineál nár dhearbhaigh ceann, ní bheadh brí ar bith leis an dearbhú. Cuir "stór" le dearbhú "${ainm}".`,

  // The finer of the two placement registries. A tábla is a building in one
  // town, so it takes one county and not a whole province — but the two
  // claims collide, and E603 is what says so in the other direction.
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
