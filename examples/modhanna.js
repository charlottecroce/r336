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

function Duine$nua(réimsí) { return Object.assign({ __cineál: "Duine" }, réimsí); }
function Duine$beannacht(féin) {
  return ("Dia duit, " + féin.ainm);
}
function Duine$aosta(féin) {
  return (féin.aois >= 18);
}
function Duine$aoisAmachAnseo(féin, blianta) {
  return (féin.aois + blianta);
}
const duine = { __cineál: "Duine", ainm: "Charlotte", aois: 20 };
scríobh(Duine$beannacht(duine));
scríobh(Duine$aosta(duine));
scríobh(Duine$aoisAmachAnseo(duine, 5));

module.exports = { Duine$nua, Duine$beannacht, Duine$aosta, Duine$aoisAmachAnseo, duine };
