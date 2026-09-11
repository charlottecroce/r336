'use strict';

// freastalaí.js — startup only (§4/§5). Stays in JavaScript on purpose:
// R336 handles route registration itself via `a <briathar>` since 0.4.
// This just builds Express, configures EJS, and listens.

const path = require('path');
const express = require('express');
const bealaí = require('./bealaí.js');

async function tóg(conairStóir = ':memory:') {
  await bealaí.tosaigh(conairStóir);

  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'amhairc'));

  bealaí.cláraigh(app);
  return { app, stór: bealaí.stór };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  tóg(process.env.STÓR || ':memory:').then(({ app }) => {
    app.listen(port, () => console.log(`ag éisteacht ar http://localhost:${port}`));
  });
}

module.exports = { tóg };