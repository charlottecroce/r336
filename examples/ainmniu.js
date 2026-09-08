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

const bun = require("../rt/bunúsach.js");
function fógair(mír) {
  scríobh(("  • " + bun.téacs(mír)));
}
function trom(mír) {
  scríobh(("  ── " + bun.téacs(mír)));
}
function príomh() {
  const liosta = ["Cáit", "Oisín", "Aoife"];
  scríobh("gnáth:");
  liosta.forEach(fógair);
  scríobh("trom:");
  liosta.forEach(trom);
}

module.exports = { bun, fógair, trom, príomh };
