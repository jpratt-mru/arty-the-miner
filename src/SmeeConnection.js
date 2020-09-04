/**
 * This is only here for when you're putzing around on a dev box.
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
