import request from "request";
import async from "async";
import { requestHeaders, rootUrl, dbClient } from "./config";
import { productQuery } from "./queries";
import * as _ from "lodash";

var productImportCount = 0;
var totalProducts = 0;

const getProductsFromDatabase = dbClient => {
  console.log("Retrieving products from ELMIS database...");
  return new Promise(function(resolve, reject) {
    dbClient
      .query(productQuery)
      .then(function(res) {
        resolve(getSanitizedProducts(res.rows));
      })
      .catch(function(err) {
        reject(err);
      });
  });
};

const getSanitizedProducts = products => {
  var newProducts = [];
  products.forEach(function(product) {
    newProducts.push({
      aggregationType: "SUM",
      domainType: "AGGREGATE",
      valueType: "NUMBER",
      code: product.code + "_" + "CO",
      programcode: product.programcode + "_co",
      name: getProductName(product, "Consumption"),
      shortName: product.code + "_" + "CO",
      categoryCombo: { id: "bjDvmb4bfuf" }
    });
    newProducts.push({
      aggregationType: "SUM",
      domainType: "AGGREGATE",
      valueType: "NUMBER",
      code: product.code + "_" + "BA",
      programcode: product.programcode + "_ba",
      name: getProductName(product, "Ending/Closing Balance"),
      shortName: product.code + "_" + "BA",
      categoryCombo: { id: "bjDvmb4bfuf" }
    });

    newProducts.push({
      aggregationType: "SUM",
      domainType: "AGGREGATE",
      valueType: "NUMBER",
      code: product.code + "_" + "ORD",
      programcode: product.programcode + "_itr",
      name: getProductName(product, "Ordered"),
      shortName: product.code + "_" + "ORD",
      categoryCombo: { id: "bjDvmb4bfuf" }
    });
  });

  return newProducts;
};

const getProductName = (product, productType) => {
  var productName = product.name + " " + product.form;

  if (product.strength !== null) {
    productName += " " + product.strength;
  }

  if (product.dosageunit !== null) {
    productName += " " + product.dosageunit;
  }

  if (product.dispensingunit !== null) {
    productName += " " + product.dispensingunit;
  }

  productName += " " + productType;
  return productName;
};

let count = 0;
const createOrUpdateProduct = async (product, callback) => {
  console.log("Importing " + product.name);
  try {
    // Update or create product
    const productPromise = await new Promise((resolve, reject) => {
      getProductFromApi(product).then(
        productResult => {
          if (productResult) {
            // Update product if available
            updateProduct({ ...productResult, ...product }).then(
              updatedProduct => {
                resolve(updatedProduct);
              },
              updateProductError => {
                reject(updateProductError);
              }
            );
          } else {
            // Add new product
            createProduct(product).then(
              createdProduct => {
                resolve(createdProduct);
              },
              createProductError => {
                reject(createProductError);
              }
            );
          }
        },
        productError => {
          reject(productError);
        }
      );
    });

    console.log("Assigning " + product.name + " to its group....");
    const productWithGroupAssigned = await assignProductToProgram(
      productPromise
    );
    productImportCount++;
    console.log(
      productImportCount + "/" + totalProducts + " Products imported"
    );
    callback(null, productWithGroupAssigned);
  } catch (e) {
    console.error(e);
    callback(e, null);
  }
};

const assignProductToProgram = product => {
  return new Promise(function(resolve, reject) {
    request(
      {
        headers: requestHeaders,
        url:
          rootUrl +
          "/api/dataElementGroups.json?fields=*&filter=code:eq:" +
          product.programcode +
          "&paging=false",
        method: "GET"
      },
      function(err, res, body) {
        if (!err) {
          const availableProgram = JSON.parse(body)["dataElementGroups"][0];
          if (availableProgram) {
            const availableProduct = _.find(availableProgram.dataElements, [
              "id",
              product.id
            ]);
            if (availableProduct) {
              resolve(product);
            } else {
              request(
                {
                  headers: requestHeaders,
                  url:
                    rootUrl + "/api/dataElementGroups/" + availableProgram.id,
                  method: "PUT",
                  json: true,
                  body: {
                    ...availableProgram,
                    dataElements: [
                      ...availableProgram.dataElements,
                      { id: product.id }
                    ]
                  }
                },
                function(err, res, body) {
                  if (!err) {
                    resolve(product);
                  } else {
                    reject(err);
                  }
                }
              );
            }
          } else {
            console.warn("program could not be found");
            resolve(product);
          }
        } else {
          reject(err);
        }
      }
    );
  });
};

const getProductFromApi = product => {
  return new Promise((resolve, reject) => {
    request(
      {
        headers: requestHeaders,
        url:
          rootUrl +
          "/api/dataElements.json?fields=id,name,code&filter=code:eq:" +
          product.code +
          "&paging=false",
        method: "GET"
      },
      (err, res, body) => {
        if (!err) {
          try {
            resolve(JSON.parse(body)["dataElements"][0]);
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

const createProduct = product => {
  const { programcode, categoryCombo, ...importableProduct } = product;
  return new Promise((resolve, reject) => {
    request(
      {
        headers: requestHeaders,
        url: rootUrl + "/api/dataElements.json",
        method: "POST",
        json: true,
        body: importableProduct
      },
      (err, res, body) => {
        if (!err) {
          resolve({
            ...product,
            id: body.response.uid
          });
        } else {
          reject(err);
        }
      }
    );
  });
};

const updateProduct = product => {
  const { programcode, ...importableProduct } = product;
  return new Promise((resolve, reject) => {
    request(
      {
        headers: requestHeaders,
        url: rootUrl + "/api/dataElements/" + product.id + ".json",
        method: "PUT",
        json: true,
        body: importableProduct
      },
      (err, res, body) => {
        if (!err) {
          resolve(product);
        } else {
          reject(err);
        }
      }
    );
  });
};

const importProducts = async callback => {
  try {
    const products = await getProductsFromDatabase(dbClient);
    totalProducts = products.length;
    console.log(products.length + " Products have been retrieved");
    console.log("Importing Products into DHIS2 system....");
    async.mapLimit(
      products,
      100,
      async.reflect(createOrUpdateProduct),
      (err, result) => {
        callback(null, result);
      }
    );
  } catch (e) {
    callback(e, null);
  }
};

export { importProducts };
