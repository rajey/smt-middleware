import { importPrograms } from "./program";
import { importProducts } from "./product";
import { importDataValues } from "./dataValueImport";
import { dbClient } from "./config";

console.log("Connecting to ELMIS database...");
dbClient.connect();
console.log("Successfully connected to ELMIS database ...");

const startDate = new Date();

const startTime = startDate.getTime();
console.log("Process started at " + startDate.toTimeString());

importPrograms((programError, programResult) => {
  // Programs result
  if (!programError) {
    console.log(
      programResult.length + " Programs have been imported successfully"
    );
  } else {
    console.error(
      "Program import has encountered errors. (ERROR): " + programError
    );
  }

  // Product import operations
  importProducts((productError, productResult) => {
    // Product import result
    if (!productError) {
      console.log(
        productResult.length + " Products have been imported successfully"
      );

      importDataValues((err, result) => {
        if (!err) {
          console.log(result.totalImportedData + " data values imported");
          console.log(result.totalIgnoredData + " data values ignored");
          const completedDate = new Date();

          const complitedTime = completedDate.getTime();
          console.log("Process completed at " + completedDate.toTimeString());
          const diff = (complitedTime - startTime) / 1000 / 60;
          console.log(
            "Process took " + Math.abs(Math.round(diff)) + " minutes"
          );
        } else {
          console.log("Data import has encountered error. (ERROR) " + err);
        }
      });
    } else {
      console.error(
        "Product import has encountered errors. (ERROR): " + productError
      );
    }
  });
});
