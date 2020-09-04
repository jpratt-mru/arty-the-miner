/**
 * We want to push the summary reports up to the submission repo (to make
 * automarking a bit easier later) - but the damn thing's stuck in a zip
 * file ('cause artifacts are zipped by GitHub).
 *
 * So we use adm-zip (https://github.com/cthackers/adm-zip) to snag the
 * summary out of the zip. The docs are kinda meh for this tool, but
 * it works for this task.
 */

const admZip = require("adm-zip");

/**
 * Since the adm-zip library doesn't have anything that returns a promise,
 * I make my own here.
 *
 * The library returns a null as data if something goes wrong, so that's
 * what we're doing for the reject() part.
 *
 * @param {*} pathToZip
 */
async function summaryContentsFrom(pathToZip) {
  var theZip = new admZip(pathToZip);
  return new Promise((resolve, reject) => {
    theZip.readFileAsync("reports/summary-report.txt", function (data) {
      if (!data) reject("extracting from zip failed");
      resolve(data.toString());
    });
  });
}

module.exports = { summaryContentsFrom };
