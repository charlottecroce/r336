'use strict';

/*
 * rt/freastal.js — an droichead chuig Express.
 *
 * Spicebag has no lambdas (see DEARADH.md §6), so the one thing it cannot do
 * for itself is wrap a handler in error plumbing. That wrapping is a runtime
 * concern rather than a language one, so it lives here and Spicebag reaches
 * it through `ó` like anything else borrowed:
 *
 *     bealach ó fhreastal(app, "/", a liostaigh)
 */

/** Register a Spicebag imperative as a GET route, forwarding rejections. */
function bealach(app, conair, lamhalai) {
  app.get(conair, (iarr, freag, ar_aghaidh) =>
    Promise.resolve(lamhalai(iarr, freag)).catch(ar_aghaidh));
}

module.exports = { bealach };
