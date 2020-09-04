/**
 * Nothing to see here (mostly) - just a POJO builder that's
 * used when we have to start uploading the submission
 * to the instructor's repo. Chock-full of useful info.
 *
 * What do we have in this thing?
 * - organization: the GitHub Classroom org where the assignment repos live
 *   - ex. MRU-CSIS-1501-201904-001
 * - name: the full zip file name (which they can find in their completed Actions on GitHub)
 *   - ex. flunxy123-friend-list-blunxy_2020-09-04T09-18.zip
 * - assessment: the name of the assessment (GitHub Classroom calls these Assignments)
 *   - ex. lab-quiz-01
 * - studentUsername: the "proper" myMRU username the user is prompted for when they initiate the submit Workflow
 *   (note that this can be different from their GitHub username, which is annoying, but hey)
 *   - ex. tstud789
 * - timestamp: text representing the time the submission was completed by the submit Workflow
 *   - ex. 2020-09-02T13-04
 * - repo: the name of the repository (without the organization part) being submitted
 *   - ex. lab-quiz-01-blunxy
 *
 * @param {*} downloadResponse
 * @param {*} organization
 */

function buildArtifactDetailsFrom(downloadResponse, organization) {
  const artifactName = artifactNameFrom(downloadResponse);
  const details = extractDetailsFrom(artifactName);

  return {
    organization: organization,
    name: artifactName,
    assessment: details.assessment,
    studentUsername: details.studentUsername,
    timestamp: details.timestamp,
    repo: details.repo,
  };
}

/**
 * The response when requesting the actual artifact download has
 * a "content-disposition" part that is the only way that I can
 * see to get the actual name of the zip file being downloaded!
 * 
 * Here's a snipped of the downloadResponse:
 * headers: {
    activityid: 'b0a9c0c4-5b3b-4536-83e9-5ab72899b073',
    'cache-control': 'no-store,no-cache',
    connection: 'close',
    'content-disposition': "attachment; filename=foo-friend-list-blunxy_2020-09-04T13-04.zip; filename*=UTF-8''foo-friend-list-blunxy_2020-09-04T13-04.zip",
    'content-type': 'application/zip'
    ....
 *
 * @param {
 * } downloadResponse
 */
function artifactNameFrom(downloadResponse) {
  const toParse = downloadResponse.headers["content-disposition"];
  const toParseSplit = toParse.split(";");
  const thisPart = toParseSplit[1].trim();
  const splitAgain = thisPart.split("=");
  return splitAgain[1];
}

/**
 * Since we want to separate submissions to the instructor's repo
 * into [assessment]/[student username]/[submission time]/[zip + summary] entries,
 * we've got to pull out this info from _somewhere_ ... and a lot of that
 * is coming from the zip file (artifact) name itself!
 *
 * A zip file has these parts: [student username]-[assessment name]-[github username]_[timestamp].zip
 * Note that the assessment name likely has further dashes in it.
 *
 * Here's an example zip file name: flunxy123-friend-list-blunxy_2020-09-04T09-18.zip
 * Note how the underscore separates the timestamp from the user/repo part.
 *
 * @param {*} artifactFileName
 */
function extractDetailsFrom(artifactFileName) {
  const firstDash = artifactFileName.indexOf("-");
  const timestampIndex = artifactFileName.lastIndexOf("_");
  const githubUsernameIndex = artifactFileName.lastIndexOf("-", timestampIndex);
  const indexOfZipExtension = artifactFileName.lastIndexOf(".zip");

  return {
    studentUsername: artifactFileName.substring(0, firstDash).toLowerCase(),
    assessment: artifactFileName.substring(firstDash + 1, githubUsernameIndex),
    repo: artifactFileName.substring(firstDash + 1, timestampIndex),
    timestamp: artifactFileName.substring(
      timestampIndex + 1,
      indexOfZipExtension
    ),
  };
}

module.exports = { buildArtifactDetailsFrom };
