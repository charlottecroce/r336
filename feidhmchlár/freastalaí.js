'use strict';

/*
 * freastalaí.js — an tosú (Céim 4 agus 5).
 *
 * Fanann an comhad seo i JavaScript d'aon ghnó, agus tá sé níos giorra anois:
 * ó chéim 0.4 déanann R336 clárú na mbealaí é féin le `a <briathar>`.
 * Níl fágtha anseo ach an tosú — Express a chruthú, EJS a shocrú, éisteacht.
 *
 * Ní gá Express ná EJS a athscríobh (§29, §30).
 */

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
