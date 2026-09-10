// arna ghiniúint ag an tiomsaitheoir R336 — ná cuir eagar air
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

function Duine$nua(réimsí) { return Object.assign({ __cineál: "Duine" }, réimsí); }
function Duine$céim(féin) {
  return ((féin.aois >= 18) ? "aosta" : "óg");
}
function fógair(duine) {
  scríobh(("── " + duine.ainm));
  scríobh(("   céim: " + Duine$céim(duine)));
}
fógair({ __cineál: "Duine", ainm: "Charlotte", aois: 20 });
fógair({ __cineál: "Duine", ainm: "Séamus", aois: 12 });
const daoine = [{ __cineál: "Duine", ainm: "Charlotte", aois: 20 }, { __cineál: "Duine", ainm: "Séamus", aois: 12 }];
scríobh(("líon: " + comhaireamh(daoine.length)));
scríobh(("folamh: " + comhaireamh([].length)));
function comhaireamh(u) {
  return ((u === 0) ? "náid" : ((u === 1) ? "aon" : "roinnt"));
}

module.exports = { Duine$nua, Duine$céim, fógair, daoine, comhaireamh };
