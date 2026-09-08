// arna ghiniúint ag an tiomsaitheoir Spicebag — ná cuir eagar air
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

function Cuntas$nua(réimsí) { return Object.assign({ __cineál: "Cuntas" }, réimsí); }
function taisc(cuntas, méid) {
  cuntas.iarmhéid = (cuntas.iarmhéid + méid);
}
function Cuntas$saibhir(féin) {
  return (féin.iarmhéid >= 100);
}
function príomh() {
  let cuntas = { __cineál: "Cuntas", úinéir: "Cáit", iarmhéid: 0 };
  taisc(cuntas, 40);
  taisc(cuntas, 70);
  scríobh(((cuntas.úinéir + ": ") + tuairisc(cuntas)));
  let comhaireamh = 0;
  comhaireamh = (comhaireamh + 1);
  comhaireamh = (comhaireamh + 1);
  scríobh(("orduithe: " + focal(comhaireamh)));
  tuairiscigh({ __cineál: "Cuntas", úinéir: "Oisín", iarmhéid: 5 });
}
function tuairisc(cuntas) {
  return (Cuntas$saibhir(cuntas) ? "saibhir" : "bocht");
}
function focal(u) {
  return ((u === 1) ? "aon" : ((u === 2) ? "dhá" : "roinnt"));
}
function tuairiscigh(cuntas) {
  if (!(Cuntas$saibhir(cuntas))) {
    scríobh((cuntas.úinéir + " is ag teastáil tuilleadh uaidh."));
  }
}

module.exports = { Cuntas$nua, taisc, Cuntas$saibhir, príomh, tuairisc, focal, tuairiscigh };
