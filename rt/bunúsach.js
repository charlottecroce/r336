'use strict';

// Conversions live in the runtime, not the language: coercion isn't
// grammatical, so you reach these through `ó` like anything borrowed.
//
//     seasmhach bun = ó "../rt/bunúsach.js"
//     seasmhach n   = uimhir ó bhun(téacs)

/** Text to number. NaN on failure, rejected by the copula as not-Uimhir. */
function uimhir(luach) { return Number(luach); }

/** Anything to text. */
function téacs(luach) { return String(luach); }

module.exports = { uimhir, téacs };