const winston = require("winston");
require("winston-papertrail").Papertrail;

/**
 * I'm currently wanting to log to https://papertrailapp.com/dashboard
 * I think it's because I feel guilty about using console.log.
 * This might be stupid.
 *
 * Much of this is cut-and-paste from https://github.com/kenperkins/winston-papertrail
 * Note that the example there is a bit dated; had to change new winston.Logger to
 * new winston.createLogger
 */
function createLogger() {
  const winstonPapertrail = new winston.transports.Papertrail({
    host: "logs2.papertrailapp.com", // this is from Settings > Log Destinations on Papertrail site
    port: 24982,
  });

  winstonPapertrail.on("error", function () {
    // ignore errors?
  });

  return new winston.createLogger({
    transports: [
      winstonPapertrail,
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
