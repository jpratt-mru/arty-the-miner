/* https://digitaldrummerj.me/node-download-zip-and-extract/ */

require("dotenv").config();
const jszip = require("jszip");
const base64 = require("file-base64");
const admZip = require("adm-zip");
const http = require("http");
const agent = require("superagent");
const fs = require("fs");
const { App } = require("@octokit/app");
const { request } = require("@octokit/request");

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

const SmeeClient = require("smee-client");

const smee = new SmeeClient({
  source: "https://smee.io/K3cYTyZkl2Ss0RO",
  target: "http://localhost:3333/events",
  logger: console,
});

const fetch = require("node-fetch");
const events = smee.start();

async function doSomethingWith(run_resp) {
  console.log("let's do something with");
  console.log(run_resp.artifacts_url);
  const trimmed = run_resp.artifacts_url.replace("https://api.github.com", "");
  console.log("TRIMMED: ", trimmed);
  let installationAccessToken = await app.getInstallationAccessToken({
    installationId: 11459311,
  });

  const responseFromArtifactRequest = await request(run_resp.artifacts_url, {
    headers: {
      authorization: `token ${installationAccessToken}`,
      accept: "application/vnd.github.machine-man-preview+json",
    },
  });

  console.log("data: ", responseFromArtifactRequest);
  const archiveDownloadUrl =
    responseFromArtifactRequest.data.artifacts[0].archive_download_url;
  console.log("I think this link: ", archiveDownloadUrl);

  installationAccessToken = await app.getInstallationAccessToken({
    installationId: 11459311,
  });
  const link = await request(archiveDownloadUrl, {
    headers: {
      authorization: `token ${installationAccessToken}`,
      accept: "application/vnd.github.v3+json",
    },
  });

  const downloadLink = link.url;
  const fileName = () => {
    const toParse = link.headers["content-disposition"];
    const toParseSplit = toParse.split(";");
    const thisPart = toParseSplit[1].trim();
    const splitAgain = thisPart.split("=");
    return splitAgain[1];
  };
  console.log("link: ", link);

  const submissionDir = "submissions";
  const zipfile = fileName();
  const zipFileInfo = extractedSubmissionInfo(zipfile);
  const fullPathToZip = `${submissionDir}/${zipfile}`;

  installationAccessToken = await app.getInstallationAccessToken({
    installationId: 11459311,
  });

  const writer = fs.createWriteStream(fullPathToZip);
  writer.on("finish", () => {
    console.log("finished writing");

    encodeIt();
  });

  await agent
    .get(downloadLink)
    .on("error", function (error) {
      console.log(error);
    })
    .pipe(writer);

  console.log("zipfile var is: ", fullPathToZip);

  function encodeIt() {
    base64.encode(fullPathToZip, function (err, base64String) {
      pushZipToSubmit(base64String);
    });
  }

  function pushSummaryToSubmit() {
    var theZip = new admZip(fullPathToZip);
    theZip.readFileAsync("reports/summary-report.txt", function (data, err) {
      const summaryFileContents = data.toString();
      request(
        `PUT /repos/MRU-CSIS-1501-DEV-PLAYGROUND/example-submission-pile/contents/${zipFileInfo.assessment}/${zipFileInfo.studentUsername}/${zipFileInfo.timestamp}/summary-report.txt`,
        {
          message: "This submit brought to you by Arty the ArtifactMiner Bot.",
          content: Buffer.from(summaryFileContents).toString("base64"),
          headers: {
            authorization: `token ${installationAccessToken}`,
            accept: "application/vnd.github.v3+json",
          },
        }
      );
    });
  }

  function pushZipToSubmit(contents) {
    request(
      `PUT /repos/MRU-CSIS-1501-DEV-PLAYGROUND/example-submission-pile/contents/${zipFileInfo.assessment}/${zipFileInfo.studentUsername}/${zipFileInfo.timestamp}/${zipFileInfo.repo}.zip`,
      {
        message: "This submit brought to you by Arty the ArtifactMiner Bot.",
        content: contents,
        headers: {
          authorization: `token ${installationAccessToken}`,
          accept: "application/vnd.github.v3+json",
        },
      }
    ).then(() => {
      pushSummaryToSubmit();
    });
  }

  /*
  base64.encode(fullPathToZip, function (err, base64String) {
    request(
      `PUT /repos/MRU-CSIS-1501-DEV-PLAYGROUND/example-submission-pile/contents/${zipFileInfo.assessment}/${zipfile}`,
      {
        message: "This submit brought to you by Arty the ArtifactMiner Bot.",
        content: base64String,
        headers: {
          authorization: `token ${installationAccessToken}`,
          accept: "application/vnd.github.v3+json",
        },
      }
    );
  });
  */
}
const cert = require("fs").readFileSync(
  ".data/artifactminer.2020-08-26.private-key.pem"
);

// const webHookHandler = require("github-webhook-handler")({
//   path: "/",
//   secret: cert,
// });

const extractedSubmissionInfo = (pathToFile) => {
  const firstDash = pathToFile.indexOf("-");
  const timestampIndex = pathToFile.lastIndexOf("_");
  const githubUsernameIndex = pathToFile.lastIndexOf("-", timestampIndex);
  const indexOfZipExtension = pathToFile.lastIndexOf(".zip");

  return {
    studentUsername: pathToFile.substring(0, firstDash),
    assessment: pathToFile.substring(firstDash + 1, githubUsernameIndex),
    repo: pathToFile.substring(firstDash + 1, timestampIndex),
    timestamp: pathToFile.substring(timestampIndex + 1, indexOfZipExtension),
  };
};

const res = extractedSubmissionInfo(
  "jpratt123-friend-list-blunxy_2020-09-01T10-47.zip"
);

const app = new App({
  id: process.env.APP_ID,
  privateKey: cert,
});

// const app = require("github-app")({
//   id: process.env.APP_ID,
//   cert: require("fs").readFileSync(
//     ".data/artifactminer.2020-08-26.private-key.pem"
//   ),
// });

const jwt = app.getSignedJsonWebToken();
console.log("jwt: ", jwt);

http.createServer(handleRequest).listen(3333);

function handleRequest(req, response) {
  // log request method & URL
  console.log(`${req.method} ${req.url}`);

  // for GET (and other non-POST) requests show "ok" and stop here
  if (req.method !== "POST") return response.end("ok");

  // for POST requests, read out the request body, log it, then show "ok" as response
  let payload = "";
  req.on("data", (data) => (payload += data));
  req.on("end", () => {
    const payloadAsObj = JSON.parse(payload);

    if (
      payloadAsObj.workflow_run &&
      payloadAsObj.workflow_run.status == "completed" &&
      payloadAsObj.workflow_run.artifacts_url
    ) {
      doSomethingWith(payloadAsObj.workflow_run);
    }

    response.end("ok");
  });

  //webHookHandler(request, response, () => response.end("ok"));
}
