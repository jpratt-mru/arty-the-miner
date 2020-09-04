/**
 * I'm currently wanting to log to https://papertrailapp.com/dashboard
 * I think it's because I feel guilty about using console.log.
 * This might be stupid.
 *
 * Much of this is cut-and-paste from https://github.com/kenperkins/winston-papertrail/tree/v2
 * To get this to work, you have to install a not-yet-official branch via npm.
 * Details here: https://github.com/kenperkins/winston-papertrail/issues/88#issuecomment-583850239
 */

const winston = require("winston");
const {
  PapertrailConnection,
  PapertrailTransport,
} = require("winston-papertrail");

function createLogger() {
  const papertrailConnection = new PapertrailConnection({
    host: "logs2.papertrailapp.com", // this is from Settings > Log Destinations on Papertrail site
    port: 24982,
  });

  papertrailConnection.on("error", function () {
    // ignore errors?
  });

  return new winston.createLogger({
    transports: [
      new PapertrailTransport(papertrailConnection),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ],
  });
}

module.exports = { createLogger };
