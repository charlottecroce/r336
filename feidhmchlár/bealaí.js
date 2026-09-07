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

const sonraí = require("./sonraí.js");
function AmharcLiosta$nua(réimsí) { return Object.assign({ __cineál: "AmharcLiosta" }, réimsí); }
function AmharcDuine$nua(réimsí) { return Object.assign({ __cineál: "AmharcDuine" }, réimsí); }
async function liostaigh(freag, stór) {
  const daoine = (await sonraí.gachDuine(stór));
  freag.render("innéacs", { __cineál: "AmharcLiosta", teideal: "Daoine", daoine: daoine });
}
async function taispeáin(freag, stór, aitheantas) {
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
async function síolaigh(stór) {
  (await sonraí.cruthaighScéim(stór));
  const rónna = (await sonraí.gachDuine(stór));
  if ((rónna.length === 0)) {
    (await sonraí.cuirDuine(stór, "Charlotte", 20));
    (await sonraí.cuirDuine(stór, "Séamus", 12));
    (await sonraí.cuirDuine(stór, "Aoife", 34));
  }
}

module.exports = { sonraí, AmharcLiosta$nua, AmharcDuine$nua, liostaigh, taispeáin, teideal, síolaigh };
