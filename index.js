/* https://digitaldrummerj.me/node-download-zip-and-extract/ */

/*

IMPORTS

*/

// dotenv lets you put info in .env file and access as process.env.blah
require("dotenv").config();

// logging is good
const { createLogger } = require("./MyLogger");

// file-base64 lets you encode a file in base64; GitHub API requires
// content pushed to repos be base64 encoded
const base64 = require("file-base64");

// adm-zip makes working with zip files (which are what artifacts are
// downloaded as) reasonably easy
const admZip = require("adm-zip");

// we need to listen for incoming info from the WebApp
const http = require("http");

// only use this to handle the request for artifact download;
// I'm not entirely sure this is needed, since we're already using
// http...but it makes things easier, so sticking with it for now
const agent = require("superagent");

// used for some file handling on the server
const fs = require("fs");

// @octokit/app is a library from GitHub that makes working with GitHub Apps
// a bit easier, particularly the authentication side
const { App } = require("@octokit/app");

// @octokit/request is a library from GitHub that makes making GitHub
// API requests a bit easier
const { request } = require("@octokit/request");

// smee-client hooks up a locally running node app to a smee.io
// url (which the GitHub App listens to for events)
const { startSmeeConnection } = require("./SmeeConnection");

/*

The body of the app.

*/

// startSmeeConnection();

const logger = createLogger();
const app = createApp();

http.createServer(handleRequest).listen(3333);

/*

All the helpers.

*/

/**
 * So this "app" is only an object that seems to handle authorization
 * for the GitHub App being used here; don't get me wrong, I'm grateful...
 * but the only place where we use this is when we need to generate a token
 * to do all the requests that are scattered around.
 *
 * Shrug.
 */
function createApp() {
  const MY_KEY = fs.readFileSync(
    ".data/artifactminer.2020-08-26.private-key.pem"
  );

  return new App({
    id: process.env.APP_ID,
    privateKey: MY_KEY,
  });
}

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
      processSubmission(payload);
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
async function processSubmission(payload) {
  const organization = payload.organization.login;
  const workflowRunId = payload.workflow_run.id;
  const assignmentRepo = payload.repository.name;
  const installationId = payload.installation.id;
  const tokenForThisSubmission = await tokenFor(installationId);

  logger.info(`=== incoming submission: ${assignmentRepo}[${organization}]`);

  const artifactResponse = await responseToArtifactRequest(
    organization,
    assignmentRepo,
    workflowRunId,
    tokenForThisSubmission
  );

  // logger.info(
  //   "requested artifact details, received this response: " +
  //     JSON.stringify(artifactResponse)
  // );

  const artifactId = submissionArtifactIdFrom(artifactResponse);

  const downloadResponse = await responseToDownloadRequest(
    organization,
    assignmentRepo,
    artifactId,
    tokenForThisSubmission
  );

  // logger.info(
  //   "requested download details, received this response: " +
  //     JSON.stringify(downloadResponse)
  // );

  const artifact = buildArtifactFrom(downloadResponse, organization);

  // logger.info(
  //   "built this artifact from the download details: " + JSON.stringify(artifact)
  // );

  saveToDisk(artifact, tokenForThisSubmission);
}

async function responseToArtifactRequest(organization, repo, id, token) {
  try {
    return await request(
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
      {
        owner: organization,
        repo: repo,
        run_id: id,
        headers: {
          authorization: `token ${token}`,
          accept: "application/vnd.github.machine-man-preview+json",
        },
      }
    );
  } catch (e) {
    logger.error("could not get an artifact request: " + e);
    return "Error";
  }
}

async function responseToDownloadRequest(organization, repo, id, token) {
  try {
    return await request(
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip",
      {
        owner: organization,
        repo: repo,
        artifact_id: id,
        headers: {
          authorization: `token ${token}`,
          accept: "application/vnd.github.v3+json",
        },
      }
    );
  } catch (e) {
    logger.error("attempt to get download failed: " + e);
    return "Error";
  }
}

/**
 * You need an installation token to perform all the groovy actions
 * (getting artifact download urls, writing to repositories, and the like)
 *
 * @param {*} payload
 */
async function tokenFor(installationId) {
  return app.getInstallationAccessToken({
    installationId: installationId,
  });
}

function submissionArtifactIdFrom(artifactResponse) {
  return artifactResponse.data.artifacts[0].id;
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

async function saveToDisk(artifact, token) {
  const submissionDir = "submissions";
  const fullPathToZip = `${submissionDir}/${artifact.name}`;

  const writer = fs.createWriteStream(fullPathToZip);
  writer.on("finish", () => {
    encodeIt(fullPathToZip, artifact, token);
  });

  agent
    .get(artifact.url)
    .on("error", function (error) {
      logger.error("error saving to disk: " + error);
    })
    .pipe(writer);
}

function encodeIt(fullPathToZip, artifact, token) {
  base64.encode(fullPathToZip, function (err, base64String) {
    pushZipToSubmit(base64String, artifact, token, fullPathToZip);
  });
}

function pushZipToSubmit(contents, artifact, token, fullPathToZip) {
  request(
    `PUT /repos/${artifact.organization}/submissions/contents/${artifact.assessment}/${artifact.studentUsername}/${artifact.timestamp}/${artifact.repo}.zip`,
    {
      message: "This submit brought to you by Arty the ArtifactMiner Bot.",
      content: contents,
      headers: {
        authorization: `token ${token}`,
        accept: "application/vnd.github.v3+json",
      },
    }
  ).then(() => {
    pushSummaryToSubmit(fullPathToZip, artifact, token);
  });
}

function pushSummaryToSubmit(fullPathToZip, artifact, token) {
  var theZip = new admZip(fullPathToZip);
  theZip.readFileAsync("reports/summary-report.txt", function (data) {
    const summaryFileContents = data.toString();
    request(
      `PUT /repos/${artifact.organization}/submissions/contents/${artifact.assessment}/${artifact.studentUsername}/${artifact.timestamp}/summary-report.txt`,
      {
        message: "This submit brought to you by Arty the ArtifactMiner Bot.",
        content: Buffer.from(summaryFileContents).toString("base64"),
        headers: {
          authorization: `token ${token}`,
          accept: "application/vnd.github.v3+json",
        },
      }
    ).then(deleteArtifactOnServer(artifact, fullPathToZip));
  });
}

function deleteArtifactOnServer(artifact, fullPathToZip) {
  fs.unlink(fullPathToZip, (err) => {
    if (err) {
      logger.error(`couldn't delete ${fullPathToZip} on server`);
      return;
    } else {
      logger.info(`=== submission completed for ${artifact.repo}`);
    }
  });
}
