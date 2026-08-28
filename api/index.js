"use strict";

// Entrypoint serverless Vercel — reexporta o handler Node do app.
// bodyParser desligado para o webhook Stripe validar a assinatura no body bruto.
const handler = require("../server/index.js");

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
