/**
 * This is only here for when you're putzing around on a dev box.
 * Here's a hack that does makes SmeeClient a stub (or is it a fake?)
 * by default, but if we're in development, uses the "real" SmeeClient.
 */
const SmeeClient = require("smee-client");

/**
 * Make a smee client that shunts GitHub webhook
 * payloads to this locally running node app.
 */
function startSmeeConnection() {
  new SmeeClient({
    source: process.env.WEBHOOK_PROXY_URL,
    target: process.env.LOCAL_APP_URL,
    logger: console,
  }).start();
}

module.exports = { startSmeeConnection };
