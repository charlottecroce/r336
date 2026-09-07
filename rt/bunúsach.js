'use strict';

/*
 * rt/bunúsach.js — an bunleabharlann.
 *
 * Conversions live in the runtime library rather than in the language.
 * Coercion is not a grammatical relationship, so it gets no syntax: you reach
 * these the way you reach anything borrowed, through `ó`.
 *
 *     seasmhach bun = ó "../rt/bunúsach.js"
 *     seasmhach n   = uimhir ó bhun(téacs)
 */

/** Text to number. NaN on failure, which the copula rejects as an Uimhir. */
function uimhir(luach) { return Number(luach); }

/** Anything to text. */
function téacs(luach) { return String(luach); }

module.exports = { uimhir, téacs };
