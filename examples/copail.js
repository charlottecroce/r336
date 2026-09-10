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
const duine = { __cineál: "Duine", ainm: "Charlotte" };
if (__is(duine, "Duine")) {
  scríobh(("Is duine é: " + duine.ainm));
}
const isDuine = __is(duine, "Duine");
scríobh(isDuine);
if (__bí(duine)) {
  scríobh("Tá duine ann.");
}
else {
  scríobh("Níl duine ar bith ann.");
}
const aois = 20;
if (__is(aois, "Uimhir")) {
  scríobh("Is uimhir í an aois.");
}
function Áit$nua(réimsí) { return Object.assign({ __cineál: "Áit" }, réimsí); }
const áit = { __cineál: "Áit", logainm: "Cill Chainnigh" };
function ganDuine(a) {
  return (!(__is(a, "Duine")) ? "Ní duine í an áit." : "?");
}
function ganAit(d) {
  return (!(__is(d, "Áit")) ? "Ní háit é an duine." : "?");
}
scríobh(ganDuine(áit));
scríobh(ganAit(duine));

module.exports = { Duine$nua, duine, isDuine, aois, Áit$nua, áit, ganDuine, ganAit };
