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
function fógair(duine) {
  scríobh((((duine.ainm + " (") + comhaireamh(duine.aois)) + ")"));
}
function comhaireamh(u) {
  return ((u < 18) ? "óg" : "aosta");
}
function príomh() {
  const daoine = [{ __cineál: "Duine", ainm: "Cáit", aois: 20 }, { __cineál: "Duine", ainm: "Oisín", aois: 12 }, { __cineál: "Duine", ainm: "Aoife", aois: 34 }];
  for (const __t0 of daoine) fógair(__t0);
}

module.exports = { Duine$nua, fógair, comhaireamh, príomh };
