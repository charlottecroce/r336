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

const __m0 = require("./stór-croí.js");
const stórlann = require("../rt/stór.js");
const croí = require("./stór-croí.js");
const SCÉIM = "CREATE TABLE IF NOT EXISTS duine (\n    ainm TEXT NOT NULL,\n    aois INTEGER NOT NULL\n)";
async function príomh() {
  const stór = (await stórlann.oscail(":memory:"));
  (await stór.scéim(SCÉIM));
  (await stór.feidhmigh("INSERT INTO duine (ainm, aois) VALUES (?, ?), (?, ?)", ["Cáit", 20, "Oisín", 34]));
  await __m0.liostaigh(stór);
  (await stór.dún());
}

module.exports = { stórlann, croí, SCÉIM, príomh };
