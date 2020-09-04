/* https://digitaldrummerj.me/node-download-zip-and-extract/ */

/*

IMPORTS

*/

// dotenv lets you put info in .env file and access as process.env.blah
require("dotenv").config();

// logging is good
const { createLogger } = require("./src/MyLogger");

// we need to listen for incoming info from the WebApp
const http = require("http");

// used for some file handling on the server
const fs = require("fs");

// smee-client hooks up a locally running node app to a smee.io
// url (which the GitHub App listens to for events)
const { startSmeeConnection } = require("./src/SmeeConnection");

let Requester = require("./src/Requester");

const util = require("util");
let { summaryContentsFrom } = require("./src/SummaryExtractor");
let writeFile = util.promisify(fs.writeFile);
let deleteFile = util.promisify(fs.unlink);

/*

The body of the app.

*/

startSmeeConnection();

const logger = createLogger();

const MY_KEY = fs.readFileSync(
  ".data/artifactminer.2020-08-26.private-key.pem"
);

let myRequester = new Requester(process.env.APP_ID, MY_KEY, 11459311);

http.createServer(handleRequest).listen(3333);

/*

All the helpers.

*/

/**
 * Look for submission requests and coming in via
 * smee and if they happen to be a submission request
 * coming in, then do all the fun stuff that has to be done.
 *
 * @param {*} req
 * @param {*} response
 */
function handleRequest(req, response) {
  // for non-POST requests show "ok" and stop here
  if (req.method !== "POST") return response.end("ok");

  // each event ferried along by smee has a payload object that
  // has all the info needed to do the submit
  let payloadAsText = "";
  req.on("data", (data) => (payloadAsText += data));
  req.on("end", () => {
    const payload = JSON.parse(payloadAsText);

    if (isSubmissionRequest()) {
      processSubmissionFrom(payload);
    }

    response.end("ok");

    function isSubmissionRequest() {
      return (
        payload.workflow_run &&
        payload.workflow_run.status == "completed" &&
        payload.workflow_run.artifacts_url
      );
    }
  });
}

/**
 * Once we have a known submission payload, we want to do these
 * things:
 *
 * - find out the id of the artifact that was part of the submission, then
 * - use that id to download the actual artifact (which is a zip file), then
 * - initiate the remaining process steps:
 *   - save the zip file temporarily to disk, after which we...
 *   - ...send that zip file to the submission repository, after which we...
 *   - ...send the contents of the summary report (which is in the zip file) to the submission repo, after which we...
 *   - ...delete the now unneeded zip file and report success.
 *
 * @param {*} payload
 */
async function processSubmissionFrom(payload) {
  const organization = payload.organization.login;
  const repo = payload.repository.name;
  const workflowRunId = payload.workflow_run.id;

  logger.info(`=== incoming submission: ${repo}[${organization}]`);

  const zipRequestResponse = await myRequester
    .encodedZipFileFor(organization, repo, workflowRunId)
    .catch((err) => logger.error(err));

  const artifact = buildArtifactFrom(zipRequestResponse, organization);

  let zipData = zipRequestResponse.data;

  if (!zipData) {
    logger.error("no zippy");
    return;
  }

  await writeFile(`submissions/${artifact.name}`, Buffer.from(zipData))
    .then(logger.log("wrote file"))
    .catch((err) => logger.error(err));

  await myRequester
    .requestZipUpload(zipData, artifact)
    .then(logger.log("uploaded zip"))
    .catch((err) => logger.error(err));

  let summaryContents = await summaryContentsFrom(
    `submissions/${artifact.name}`
  ).catch((err) => logger.error(err));

  await myRequester
    .requestSummaryUpload(summaryContents, artifact)
    .then(logger.log("uploaded summary"))
    .catch((err) => logger.error(err));

  await deleteFile(`submissions/${artifact.name}`)
    .then(logger.info(`=== submission completed for ${artifact.repo}`))
    .catch((err) => logger.error(err));
}

function artifactNameFrom(downloadResponse) {
  const toParse = downloadResponse.headers["content-disposition"];
  const toParseSplit = toParse.split(";");
  const thisPart = toParseSplit[1].trim();
  const splitAgain = thisPart.split("=");
  return splitAgain[1];
}

function extractDetailsFrom(name) {
  const firstDash = name.indexOf("-");
  const timestampIndex = name.lastIndexOf("_");
  const githubUsernameIndex = name.lastIndexOf("-", timestampIndex);
  const indexOfZipExtension = name.lastIndexOf(".zip");

  return {
    studentUsername: name.substring(0, firstDash).toLowerCase(),
    assessment: name.substring(firstDash + 1, githubUsernameIndex),
    repo: name.substring(firstDash + 1, timestampIndex),
    timestamp: name.substring(timestampIndex + 1, indexOfZipExtension),
  };
}

function buildArtifactFrom(downloadResponse, organization) {
  const artifactName = artifactNameFrom(downloadResponse);
  const details = extractDetailsFrom(artifactName);

  return {
    url: downloadResponse.url,
    organization: organization,
    name: artifactName,
    assessment: details.assessment,
    studentUsername: details.studentUsername,
    timestamp: details.timestamp,
    repo: details.repo,
  };
}
