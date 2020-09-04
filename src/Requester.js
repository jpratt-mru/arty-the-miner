let { request } = require("@octokit/request");
const { createAppAuth } = require("@octokit/auth-app");

class Requester {
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
   * The data from this response contains the id of the artifact
   * we want to download.
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

  requestZipUpload(contents, artifact) {
    return this.requestUpload(contents, artifact, `${artifact.repo}.zip`);
  }

  requestSummaryUpload(contents, artifact) {
    return this.requestUpload(contents, artifact, "summary-report.txt");
  }

  requestUpload(contents, artifact, uploadName) {
    return this.authorizedRequest(
      `PUT /repos/${artifact.organization}/submissions/contents/${artifact.assessment}/${artifact.studentUsername}/${artifact.timestamp}/${uploadName}`,
      {
        message: "This submit brought to you by Arty the ArtifactMiner Bot.",
        content: Buffer.from(contents).toString("base64"),
      }
    );
  }

  async encodedZipFileFor(organization, repo, workflowRunId) {
    let resp = await this.requestArtifactDetails(
      organization,
      repo,
      workflowRunId
    );

    resp = await this.requestArtifactDownload(
      organization,
      repo,
      resp.data.artifacts[0].id
    );

    return resp;
  }
}

module.exports = Requester;
