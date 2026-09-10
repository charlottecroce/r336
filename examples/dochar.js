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

function Earráid$nua(réimsí) { return Object.assign({ __cineál: "Earráid" }, réimsí); }
function roinn(uachtar, íochtar) {
  return ((íochtar === 0) ? { __cineál: "Earráid", cúis: "ní roinntear ar nialas" } : (uachtar / íochtar));
}
function luaigh(uachtar, íochtar) {
  const toradh = roinn(uachtar, íochtar);
  if (__is(toradh, "Earráid")) {
    scríobh(("theip air: " + toradh.cúis));
  }
  else {
    scríobh(toradh);
  }
}
function slán(toradh) {
  return (!(__is(toradh, "Earráid")) ? true : false);
}
function príomh() {
  luaigh(10, 2);
  luaigh(10, 0);
}

module.exports = { Earráid$nua, roinn, luaigh, slán, príomh };
