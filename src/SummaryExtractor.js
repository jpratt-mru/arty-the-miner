const admZip = require("adm-zip");

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
