/**
 * So there are 4 requests that are made via the GitHub API that we need to
 * make to get all this working:
 *
 * - we need to make a request to get the ID of the artifact that was created upon submission
 * - once we have that ID, we need to make a request to actually _get_ that artifact
 * - once we have the artifact, we need to make a request to punt it up to the instructor's
 *   submission repo, and finally,
 * - we make a final request to push the summary text report from the artifact to the instructor's
 *   submission repo as well
 *
 * With so many requests, it seemed to make sense to make a class that handled it all!
 *
 */

// @octokit/request (https://github.com/octokit/request.js/)
// makes dealing with the GitHub API less painful...and authentication
// (which is usually a bear to deal with) is handled by...
let { request } = require("@octokit/request");

// @octokit/auth-app (https://github.com/octokit/auth-app.js/)
// makes the authentication part of API requests to private repos
// *much* less painful (otherwise you gotta do a lotta token work)
const { createAppAuth } = require("@octokit/auth-app");

class Requester {
  /**
   * The following is basically copy-pasta from
   * https://github.com/octokit/auth-app.js/
   *
   * @param {*} id
   * @param {*} privateKey
   * @param {*} installationId
   */
  constructor(id, privateKey, installationId) {
    this.auth = createAppAuth({
      id,
      privateKey,
      installationId,
    });
    this.authorizedRequest = request.defaults({
      request: {
        hook: this.auth.hook,
      },
    });
  }

  /**
   * The data from this response contains (among many other things!) the ids
   * of ALL the artifacts for a given workflow run.
   *
   * See: https://docs.github.com/en/rest/reference/actions#list-workflow-run-artifacts
   *
   * @param {*} organization
   * @param {*} repo
   * @param {*} workflowRunId
   */
  requestArtifactDetails(organization, repo, workflowRunId) {
    // we use defaults here because for this (and only this!)
    // request we don't want to use the default of application/vnd.github.v3+json
    const acceptsMachineManRequest = this.authorizedRequest.defaults({
      headers: {
        accept: "application/vnd.github.machine-man-preview+json",
      },
    });

    return acceptsMachineManRequest(
      "GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts",
      {
        owner: organization,
        repo: repo,
        run_id: workflowRunId,
      }
    );
  }

  /**
   * Downloads a _specific_ artifact that was generated from a given
   * workflow submission. (Remember that a given workflow run, multiple
   * artifacts may be saved; this method's interested getting a
   * _specific_ one).
   *
   * See: https://docs.github.com/en/rest/reference/actions#download-an-artifact
   *
   * @param {*} organization
   * @param {*} repo
   * @param {*} artifactId
   */
  requestArtifactDownload(organization, repo, artifactId) {
    return this.authorizedRequest(
      "GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip",
      {
        owner: organization,
        repo: repo,
        artifact_id: artifactId,
      }
    );
  }

  /**
   * Helper that's used by the two methods (requestZipUpload and requestSummaryUpload)
   * that upload the zip and summary report files to the instructor's submission repo.
   *
   * Uploads go into [assessment name]/[student username]/[timestamp]/<HERE>
   *
   * See: https://docs.github.com/en/rest/reference/repos#create-or-update-file-contents
   *
   * We don't worry about needing a sha, since we're never updating content - we're
   * always creating new content! (Thanks to the fact that we're putting each
   * submission in its own timestamped directory.)
   *
   *
   * @param {*} contents
   * @param {*} artifact
   * @param {*} uploadName
   */
  requestUpload(contents, artifact, uploadName) {
    return this.authorizedRequest(
      `PUT /repos/${artifact.organization}/submissions/contents/${artifact.assessment}/${artifact.studentUsername}/${artifact.timestamp}/${uploadName}`,
      {
        message: "This submit brought to you by Arty the ArtifactMiner Bot.",
        content: Buffer.from(contents).toString("base64"), // uploads have to be encoded to base64; API says so
      }
    );
  }

  requestZipUpload(contents, artifact) {
    return this.requestUpload(contents, artifact, `${artifact.repo}.zip`);
  }

  requestSummaryUpload(contents, artifact) {
    return this.requestUpload(contents, artifact, "summary-report.txt");
  }

  /**
   *
   * Convenience method to request the very first artifact
   * from a given workflow run.
   *
   * @param {*} organization
   * @param {*} repo
   * @param {*} workflowRunId
   */
  async requestFirstArtifact(organization, repo, workflowRunId) {
    let resp = await this.requestArtifactDetails(
      organization,
      repo,
      workflowRunId
    );

    resp = await this.requestArtifactDownload(
      organization,
      repo,
      resp.data.artifacts[0].id // artifacts[] has an array of artifact info; we want the first
    );

    return resp;
  }
}

module.exports = Requester;
