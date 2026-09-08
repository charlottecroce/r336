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

const stórlann = require("../rt/stór.js");
async function ainmneacha(stór) {
  return (await stór.ceistigh("SELECT ainm FROM daoine ORDER BY ainm", []));
}
async function príomh() {
  const stór = (await stórlann.oscail(":memory:"));
  (await stór.scéim("CREATE TABLE daoine (ainm TEXT)"));
  (await stór.feidhmigh("INSERT INTO daoine (ainm) VALUES (?), (?)", ["Cáit", "Oisín"]));
  const rónna = (await ainmneacha(stór));
  scríobh(("líon: " + comhaireamh(rónna.length)));
  scríobh(("an chéad cheann: " + rónna[0].ainm));
  (await stór.dún());
}
function comhaireamh(u) {
  return ((u === 0) ? "náid" : ((u === 1) ? "aon" : "roinnt"));
}

module.exports = { stórlann, ainmneacha, príomh, comhaireamh };
