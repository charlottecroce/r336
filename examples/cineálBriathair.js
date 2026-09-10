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

function fógair(t) {
  scríobh(t);
}
function faoiDhó(g, liosta) {
  for (const __t0 of liosta) g(__t0);
  for (const __t1 of liosta) g(__t1);
}
function dúbail(u) {
  return (u + u);
}
function cuirIbhFeidhm(f, u) {
  return f(u);
}
function príomh() {
  faoiDhó(fógair, ["a", "b"]);
  scríobh(cuirIbhFeidhm(dúbail, 21));
}

module.exports = { fógair, faoiDhó, dúbail, cuirIbhFeidhm, príomh };
