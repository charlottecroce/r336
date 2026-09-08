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

const __m0 = require("./sonraí.js");
const sonraí = require("./sonraí.js");
const bun = require("../rt/bunúsach.js");
const freastal = require("../rt/freastal.js");
function AmharcLiosta$nua(réimsí) { return Object.assign({ __cineál: "AmharcLiosta" }, réimsí); }
function AmharcDuine$nua(réimsí) { return Object.assign({ __cineál: "AmharcDuine" }, réimsí); }
function Síol$nua(réimsí) { return Object.assign({ __cineál: "Síol" }, réimsí); }
let stór = null;
const síolta = [{ __cineál: "Síol", ainm: "Charlotte", aois: 20 }, { __cineál: "Síol", ainm: "Séamus", aois: 12 }, { __cineál: "Síol", ainm: "Aoife", aois: 34 }];
async function tosaigh(conair) {
  stór = (await sonraí.oscailStór(conair));
  await síolaigh();
}
async function cuirSíol(s) {
  await __m0.cuirDuine(stór, s.ainm, s.aois);
}
async function síolaigh() {
  await __m0.cruthaighScéim(stór);
  const rónna = (await sonraí.gachDuine(stór));
  if ((rónna.length === 0)) {
    for (const __t0 of síolta) await cuirSíol(__t0);
  }
}
async function liostaigh(iarr, freag) {
  const daoine = (await sonraí.gachDuine(stór));
  freag.render("innéacs", { __cineál: "AmharcLiosta", teideal: "Daoine", daoine: daoine });
}
async function taispeáin(iarr, freag) {
  const aitheantas = bun.uimhir(iarr.params.id);
  if (__is(aitheantas, "Uimhir")) {
    const duine = (await sonraí.duineDeRéir(stór, aitheantas));
    freag.render("duine", { __cineál: "AmharcDuine", teideal: teideal(duine), duine: duine, aimsíodh: __bí(duine) });
  }
  else {
    freag.status(400);
    freag.send("Aitheantas neamhbhailí.");
  }
}
function teideal(duine) {
  return (__bí(duine) ? "Duine" : "Gan aimsiú");
}
function cláraigh(app) {
  freastal.bealach(app, "/", liostaigh);
  freastal.bealach(app, "/duine/:id", taispeáin);
}

module.exports = { sonraí, bun, freastal, AmharcLiosta$nua, AmharcDuine$nua, Síol$nua, síolta, tosaigh, cuirSíol, síolaigh, liostaigh, taispeáin, teideal, cláraigh };
Object.defineProperty(module.exports, "stór", { get: () => stór, enumerable: true });
