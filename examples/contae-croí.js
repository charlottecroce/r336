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

function Imreoir$nua(réimsí) { return Object.assign({ __cineál: "Imreoir" }, réimsí); }
function Foireann$nua(réimsí) { return Object.assign({ __cineál: "Foireann" }, réimsí); }
function ainmDe(imreoir) {
  return imreoir.ainm;
}
function óg(imreoir) {
  return (imreoir.aois < 21);
}
function clúdach(foireann) {
  return ("Foireann: " + foireann.ainm);
}
function fógair(imreoir) {
  scríobh(ainmDe(imreoir));
}

module.exports = { Imreoir$nua, Foireann$nua, ainmDe, óg, clúdach, fógair };
