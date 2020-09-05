/**
 * This just sits here, listens to POSTs coming in from
 * GitHub, and reacts to them.
 *
 * It coordinates with the GitHub App ArtifactMinder (https://github.com/apps/artifactminer)
 *
 * If you're running this on a development box, you'll
 * want to go to the ArtifactMiner GitHub App's settings
 * (https://github.com/settings/apps/artifactminer) and make sure
 * the Webhook URL is pointing to https://smee.io/K3cYTyZkl2Ss0RO
 *
 * Likewise, if you're running this code on a production box, that same
 * URL should be whatever the box's settings are.
 *
 * I'm currently logging to both console and to Papertrail.
 */

// dotenv lets you put info in .env file and access as process.env.blah
require("dotenv").config();

// logging is good
const { createLogger } = require("./src/MyLogger");

// we need to listen for incoming info from the WebApp
const http = require("http");

// smee-client hooks up a locally running node app to a smee.io
// url (which the GitHub App listens to for events)
// NOTE: this is only used during development, not production!
const { startSmeeConnection } =
  process.env.NODE_ENV === "production"
    ? { function() {} }
    : require("./src/SmeeConnection");

// this is a factory that lets us create things that react
// to certain payloads...in this case, submission payloads
const { buildReacterFrom } = require("./src/PayloadReacterBuilder");

const logger = createLogger();

if (process.env.NODE_ENV === "development") {
  logger.info("running in development mode...");
  logger.info("connecting to Smee");
  startSmeeConnection();
}

http.createServer(handleRequest).listen(process.env.PORT);

/**
 * Builds payload text coming in to this server and
 * feeds it to a PayloadReactor who's job it is to actually
 * deal with it.
 *
 * @param {*} req
 * @param {*} response
 */
function handleRequest(req, response) {
  // all Webhook payloads are POSTs, so for non-POST
  // requests show "ok" and stop here
  if (req.method !== "POST") return response.end("ok");

  let payloadText = "";
  req.on("data", (data) => (payloadText += data));
  req.on("end", () => {
    buildReacterFrom(payloadText, logger).react();
    response.end("ok");
  });
}
