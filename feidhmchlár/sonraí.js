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
const SCÉIM = "CREATE TABLE IF NOT EXISTS daoine (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    ainm TEXT NOT NULL,\n    aois INTEGER NOT NULL\n)";
async function oscailStór(conair) {
  return (await stórlann.oscail(conair));
}
async function cruthaighScéim(stór) {
  (await stór.scéim(SCÉIM));
}
async function gachDuine(stór) {
  return (await stór.ceistigh("SELECT id, ainm, aois FROM daoine ORDER BY ainm", []));
}
async function duineDeRéir(stór, aitheantas) {
  const rónna = (await stór.ceistigh("SELECT id, ainm, aois FROM daoine WHERE id = ?", [aitheantas]));
  return rónna[0];
}
async function cuirDuine(stór, ainm, aois) {
  (await stór.feidhmigh("INSERT INTO daoine (ainm, aois) VALUES (?, ?)", [ainm, aois]));
}

module.exports = { stórlann, SCÉIM, oscailStór, cruthaighScéim, gachDuine, duineDeRéir, cuirDuine };
