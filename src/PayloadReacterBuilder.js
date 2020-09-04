/**
 * A factory for what I call "PayloadReacters" - things that
 * react to payloads. (No, it's not a spelling error!)
 */

const DefaultPayloadReacter = require("./DefaultPayloadReacter");
const SubmissionPayloadReacter = require("./SubmissionPayloadReacter");

/**
 * We're tossing in the logger because it's made at the uppermost level
 * of the app (index.js)...though I see it's not being actually used there
 * currently. Hmmm....
 *
 * @param {*} payloadText
 * @param {*} logger
 */
function buildReacterFrom(payloadText, logger) {
  const payload = JSON.parse(payloadText);

  if (!isSubmissionPayload()) return new DefaultPayloadReacter();

  return new SubmissionPayloadReacter(payload, logger);

  /**
   * We only consider a payload a submission payload if
   * it comes from a workflow_run with a status of
   * completed...and it has an actual artifact attached!
   */
  function isSubmissionPayload() {
    return (
      payload.workflow_run &&
      payload.workflow_run.status == "completed" &&
      payload.workflow_run.artifacts_url
    );
  }
}

module.exports = { buildReacterFrom };
