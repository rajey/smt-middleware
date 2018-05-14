import request from "request";
import async from "async";
import { requestHeaders, rootUrl, dbClient } from "./config";

const getSanitizedPrograms = programs => {
  var newPrograms = [];
  programs.forEach(function(program) {
    newPrograms.push({
      code: program.code + "_co",
      name: program.name + " Consumption"
    });
    newPrograms.push({
      code: program.code + "_ba",
      name: program.name + " Ending/Closing balance"
    });

    newPrograms.push({
      code: program.code + "_itr",
      name: program.name + " Item fill rate"
    });

    newPrograms.push({
      code: program.code + "_ord",
      name: program.name + " Ordered"
    });
  });

  return newPrograms;
};

const createOrUpdateProgram = async (productProgram, callback) => {
  try {
    const programPromise = await new Promise((resolve, reject) => {
      getProgramFromApi(productProgram).then(
        program => {
          if (program) {
            // Update program if available
            updateProgram({ ...program, ...productProgram }).then(
              updatedProgram => {
                resolve(updatedProgram);
              },
              updateProgramError => {
                reject(updateProgramError);
              }
            );
          } else {
            // Add new program
            createProgram(productProgram).then(
              createdProgram => {
                resolve(createdProgram);
              },
              createProgramError => {
                reject(createProgramError);
              }
            );
          }
        },
        programError => {
          reject(programError);
        }
      );
    });

    callback(null, programPromise);
  } catch (e) {
    callback(e, null);
  }
};

const getProgramFromApi = program => {
  return new Promise((resolve, reject) => {
    request(
      {
        headers: requestHeaders,
        url:
          rootUrl +
          "/api/dataElementGroups.json?fields=id,name,code&filter=code:eq:" +
          program.code +
          "&paging=false",
        method: "GET"
      },
      (err, res, body) => {
        if (!err) {
          try {
            resolve(JSON.parse(body)["dataElementGroups"][0]);
          } catch (e) {
            reject(e);
          }
        } else {
          reject(err);
        }
      }
    );
  });
};

const createProgram = program => {
  return new Promise((resolve, reject) => {
    request(
      {
        headers: requestHeaders,
        url: rootUrl + "/api/dataElementGroups.json",
        method: "POST",
        json: true,
        body: {
          code: program.code,
          name: program.name,
          shortName: program.name
        }
      },
      (err, res, body) => {
        if (!err) {
          resolve({
            id: body.response.uid,
            code: program.code,
            name: program.name
          });
        } else {
          reject(err);
        }
      }
    );
  });
};

const updateProgram = program => {
  return new Promise((resolve, reject) => {
    request(
      {
        headers: requestHeaders,
        url: rootUrl + "/api/dataElementGroups/" + program.id + ".json",
        method: "PUT",
        json: true,
        body: {
          id: program.id,
          code: program.code,
          name: program.name,
          shortName: program.name
        }
      },
      (err, res, body) => {
        if (!err) {
          resolve(program);
        } else {
          reject(err);
        }
      }
    );
  });
};

const getProgramsFromDatabase = dbClient => {
  console.log("Retrieving programs from ELMIS database...");
  return new Promise(function(resolve, reject) {
    dbClient
      .query(
        "SELECT DISTINCT SUBSTRING(code, 1, 3) AS code,SUBSTRING(UPPER(name), 1,3) AS name FROM programs"
      )
      .then(function(res) {
        resolve(getSanitizedPrograms(res.rows));
      })
      .catch(function(err) {
        reject(err);
      });
  });
};

const importPrograms = async callback => {
  try {
    const programs = await getProgramsFromDatabase(dbClient);
    console.log(programs.length + " Programs have been retrieved");
    console.log("Importing Programs into DHIS2 system....");
    async.mapLimit(
      programs,
      10,
      async.reflect(createOrUpdateProgram),
      (err, result) => {
        callback(null, result);
      }
    );
  } catch (e) {
    callback(e, null);
  }
};

export { importPrograms };
