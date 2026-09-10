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
function Aois$nua(réimsí) { return Object.assign({ __cineál: "Aois" }, réimsí); }
const duine = { __cineál: "Duine", ainm: "Cáit" };
const aois = { __cineál: "Aois", luach: 20 };
let comhaireamh = 0;
let tuairisc = "";
const x = 3;
function cur(a, b) {
  return (a + b);
}
function príomh() {
  comhaireamh = cur(comhaireamh, aois.luach);
  tuairisc = duine.ainm;
  scríobh(tuairisc);
  scríobh(comhaireamh);
  scríobh(x);
}

module.exports = { Duine$nua, Aois$nua, duine, aois, x, cur, príomh };
Object.defineProperty(module.exports, "comhaireamh", { get: () => comhaireamh, enumerable: true });
Object.defineProperty(module.exports, "tuairisc", { get: () => tuairisc, enumerable: true });
