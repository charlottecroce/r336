'use strict';

// Bridge to Express. R336 has no lambdas, so wrapping a handler in error
// plumbing lives here and is reached via `ó`:
//
//     bealach ó fhreastal(app, "/", a liostaigh)

/** Register a R336 imperative as a GET route, forwarding rejections. */
function bealach(app, conair, lamhalai) {
  app.get(conair, (iarr, freag, ar_aghaidh) =>
    Promise.resolve(lamhalai(iarr, freag)).catch(ar_aghaidh));
}

module.exports = { bealach };