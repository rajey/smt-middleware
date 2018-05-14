import { importPrograms } from "./program";
import { importProducts } from "./product";
import { importDataValues } from "./dataValueImport";
import { dbClient } from "./config";

console.log("Connecting to ELMIS database...");
dbClient.connect();
console.log("Successfully connected to ELMIS database ...");

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
        console.log(result);
      });
    } else {
      console.error(
        "Product import has encountered errors. (ERROR): " + productError
      );
    }
  });
});

// importDataValues((err, result) => {
//   console.log(result);
// });
