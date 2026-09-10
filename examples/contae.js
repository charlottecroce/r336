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

const __m0 = require("./contae-croí.js");
const croí = require("./contae-croí.js");
function Iontráil$nua(réimsí) { return Object.assign({ __cineál: "Iontráil" }, réimsí); }
function próiseáil(iontráil) {
  __m0.fógair({ __cineál: "Imreoir", ainm: iontráil.ainm, aois: iontráil.aois });
}
function príomh() {
  const amh = [{ __cineál: "Iontráil", ainm: "Cáit", aois: 19 }, { __cineál: "Iontráil", ainm: "Séamus", aois: 34 }];
  for (const __t0 of amh) próiseáil(__t0);
  scríobh(__m0.clúdach({ __cineál: "Foireann", ainm: "Na Piarsaigh" }));
}

module.exports = { croí, Iontráil$nua, próiseáil, príomh };
