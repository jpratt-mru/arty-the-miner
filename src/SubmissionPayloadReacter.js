/**
 *
 * This is where the "real work" gets done.
 *
 * This reacter is what actually makes the requests via the GitHub API
 * to grab the artifact (submission zip) and commit it to the
 * submissions repo in the organization where GitHub Assignments
 * are being submitted.
 *
 */

require("dotenv").config();
const Requester = require("./Requester");
const { buildArtifactDetailsFrom } = require("./ArtifactDetails");

const util = require("util");
const fs = require("fs");
const saveLocalSubmission = util.promisify(fs.writeFile);
const deleteLocalSubmission = util.promisify(fs.unlink);
const { summaryContentsFrom } = require("./SummaryExtractor");

class SubmissionPayloadReacter {
  constructor(payload, logger) {
    this.payload = payload;
    this.logger = logger;
  }

  /**
   * Once we have a known submission this.payload, we want to do these
   * things:
   *
   * - create a Requester to handle the creation of authorized requests for the
   *   rest of the work that has to be done next
   * - request the first artifact from the workflow that just completed; this request
   *   gets us both the artifact (zip file) itself, as well as the _name_ of that
   *   artifact, which we need for further steps
   * - save the zip file temporarily to disk, after which we...
   *   - ...send that zip file to the submission repository, after which we...
   *   - ...send the contents of the summary report (which is in the zip file) to the submission repo, after which we...
   *   - ...delete the now unneeded zip file and then finally...
   *   - ...we report success.
   *
   * @param {*} this.payload
   */
  async react() {
    const organization = this.payload.organization.login;
    const repo = this.payload.repository.name;
    const workflowRunId = this.payload.workflow_run.id;
    const installationId = this.payload.installation.id;

    this.logger.info(`=== incoming submission: ${repo}[${organization}]`);

    // if there's a private key available from process.env - the *real* one,
    // not the dotenv library one - then we use that; otherwise, we're
    // going to pull in the key from the pem file.active
    //
    // I *would* have just put the key into the .env file and used the dotenv
    // library, but there are issues with that library and multi-line strings
    //
    // since this file shouldn't be punted to GitHub, I've put it in
    // the .gitignore and punted a copy to my work Google Drive (development-files)
    // folder. Yes, I know there are other ways to secure things, but I'm kinda
    // done on this sucker for a while! :)
    //
    const PRIVATE_KEY =
      process.env.PRIVATE_KEY ||
      fs.readFileSync(".data/artifactminer.2020-08-26.private-key.pem");

    let requester = new Requester(
      process.env.APP_ID,
      PRIVATE_KEY,
      installationId
    );

    const artifactRequestResponse = await requester
      .requestFirstArtifact(organization, repo, workflowRunId)
      .catch((err) =>
        this.logger.error(
          `@@ ARTY ERROR @@ :: (requestFirstArtifact) :: ${err}`
        )
      );

    const artifactDetails = buildArtifactDetailsFrom(
      artifactRequestResponse,
      organization
    );

    let zipData = artifactRequestResponse.data;

    if (!zipData) {
      this.logger.error(
        "@@ ARTY ERROR @@ :: couldn't get zip file  from submission...stopping."
      );
      return;
    }

    const pathToZip = `submissions/${artifactDetails.name}`;

    await saveLocalSubmission(pathToZip, Buffer.from(zipData))
      .then(this.logger.info(`wrote local ${pathToZip}`))
      .catch((err) =>
        this.logger.error(`@@ ARTY ERROR @@ :: (saveLocalSubmission) :: ${err}`)
      );

    await requester
      .requestZipUpload(zipData, artifactDetails)
      .then(this.logger.info(`uploaded zip ${artifactDetails.name}`))
      .catch((err) =>
        this.logger.error(`@@ ARTY ERROR @@ :: (requestZipUpload) :: ${err}`)
      );

    let summaryContents = await summaryContentsFrom(pathToZip).catch((err) =>
      this.logger.error(`@@ ARTY ERROR @@ :: (summaryContentsFrom) :: ${err}`)
    );

    await requester
      .requestSummaryUpload(summaryContents, artifactDetails)
      .then(this.logger.info(`uploaded summary from ${artifactDetails.name}`))
      .catch((err) =>
        this.logger.error(
          `@@ ARTY ERROR @@ :: (requestSummaryUpload) :: ${err}`
        )
      );

    await deleteLocalSubmission(pathToZip)
      .then(() => {
        this.logger.info(`deleted local ${pathToZip}`);
        this.logger.info(
          `=== submission completed for ${artifactDetails.repo}`
        );
      })
      .catch((err) =>
        this.logger.error(
          `@@ ARTY ERROR @@ :: (deleteLocalSubmission) :: ${err}`
        )
      );
  }
}

module.exports = SubmissionPayloadReacter;
