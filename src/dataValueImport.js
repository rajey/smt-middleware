import request from "request";
import async from "async";
import * as _ from "lodash";
import { requestHeaders, rootUrl, dbClient } from "./config";
import { productDataQuery } from "./queries";

let importCount = 0;

const importDataValues = async callback => {
  try {
    const facilityList = await getFacilityList();

    async.mapLimit(
      facilityList,
      50,
      async.reflect(importDataByFacility),
      (err, result) => {
        callback(null, result);
      }
    );
  } catch (e) {
    console.error(e);
  }
};

const importDataByFacility = async (facility, callback) => {
  const facilityDataResult = await getProductsDataFromDatabase(facility.code);
  const groupedFacilityData = _.groupBy(facilityDataResult, "productcode");
  const productDataArray = _.map(_.keys(groupedFacilityData), productKey => {
    return {
      productCode: productKey,
      facilityId: facility.id,
      rnr: groupedFacilityData[productKey]
    };
  });

  async.mapLimit(
    productDataArray,
    50,
    async.reflect(importDataByProduct),
    (err, result) => {
      callback(null, result);
    }
  );
};

const importDataByProduct = async (productData, callback) => {
  console.log(
    "Preparing data for product with code " +
      productData.productCode +
      " for facility with id " +
      productData.facilityId
  );
  const associatedProducts = await findAssociatedProducts(
    productData.productCode
  );
  const dataValues = [];

  _.each(productData.rnr, rnr => {
    const periods = getProperPeriod(
      new Date(rnr.startdate),
      new Date(rnr.enddate)
    );

    _.each(periods, period => {
      _.each(associatedProducts, product => {
        if (product.code.indexOf("_CO") > -1 && rnr.amc && rnr.amc !== 0) {
          dataValues.push({
            dataElement: product.id,
            period: period,
            orgUnit: productData.facilityId,
            value: rnr.amc ? rnr.amc.toString() : ""
          });
        } else if (
          product.code.indexOf("_BA") > -1 &&
          rnr.stockinhand &&
          rnr.stockinhand !== 0
        ) {
          dataValues.push({
            dataElement: product.id,
            period: period,
            orgUnit: productData.facilityId,
            value: rnr.stockinhand
              ? (rnr.stockinhand / 3).toFixed(0).toString()
              : ""
          });
        } else if (
          product.code.indexOf("_ORD") > -1 &&
          rnr.quantityrequested &&
          rnr.quantityrequested !== 0
        ) {
          dataValues.push({
            dataElement: product.id,
            period: period,
            orgUnit: productData.facilityId,
            value: rnr.stockinhand ? rnr.quantityrequested : ""
          });
        }
      });
    });
  });

  if (dataValues.length > 0) {
    console.log(
      "Importing " +
        dataValues.length +
        " data values for facility with id " +
        productData.facilityId
    );
    const dataValueImportResult = await dataValueImport({
      dataValues: dataValues
    });
    console.log(
      "Importing " +
        dataValues.length +
        " data values for facility with id " +
        productData.facilityId +
        " completed"
    );
    importCount += dataValues.length;
    console.log(importCount);
    callback(null, dataValueImportResult);
  } else {
    callback(null, null);
  }
};

const dataValueImport = dataValues => {
  return new Promise((resolve, reject) => {
    request(
      {
        headers: requestHeaders,
        url: rootUrl + "/api/dataValueSets",
        method: "POST",
        json: true,
        body: dataValues
      },
      function(err, res, body) {
        if (!err) {
          resolve(body);
        } else {
          reject(err);
        }
      }
    );
  });
};

const findAssociatedProducts = productCode => {
  return new Promise((resolve, reject) => {
    request(
      {
        headers: requestHeaders,
        url:
          rootUrl +
          "/api/dataElements.json?fields=id,name,code&filter=code:ilike:" +
          productCode +
          "&paging=false",
        method: "GET"
      },
      function(err, res, body) {
        if (!err) {
          resolve(JSON.parse(body)["dataElements"]);
        } else {
          reject(err);
        }
      }
    );
  });
};

const getProperPeriod = (startDate, endDate) => {
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const startMonth = startDate.getMonth();
  const endMonth = endDate.getMonth();
  return [
    computePeriod(startYear, startMonth + 1),
    computePeriod(startMonth === 10 ? startYear : endYear, startMonth + 2),
    computePeriod(endYear, endMonth + 1),
    computePeriod(
      endMonth === 11 ? endYear + 1 : endYear,
      endMonth === 11 ? 1 : endMonth + 2
    )
  ];
};

const computePeriod = (year, month) => {
  const properMonth = month < 10 ? "0" + month : month;

  return year.toString() + properMonth;
};

const getFacilityList = () => {
  return new Promise((resolve, reject) => {
    request(
      {
        headers: requestHeaders,
        url:
          rootUrl +
          "/api/organisationUnits.json?fields=id,code&filter=level:eq:5&paging=false",
        method: "GET"
      },
      function(err, res, body) {
        if (!err) {
          resolve(JSON.parse(body)["organisationUnits"]);
        } else {
          reject(err);
        }
      }
    );
  });
};

const getProductsDataFromDatabase = facilityCode => {
  console.log(
    "Retrieving facility data with code " +
      facilityCode +
      " from ELMIS database..."
  );

  return new Promise(function(resolve, reject) {
    dbClient
      .query(
        "WITH Req AS (SELECT r.id requisitionid,r.createddate requisitioncreateddate," +
          "r.modifieddate requisitionmodifieddate,* FROM requisitions r " +
          "JOIN facilities f ON r.facilityid = f.id " +
          "JOIN processing_periods pp ON r.periodid = pp.id " +
          "WHERE f.code ='" +
          facilityCode +
          "' AND status IN('RELEASED', 'APPROVED','IN_APPROVAL') " +
          "AND emergency IS FALSE ORDER BY r.createddate DESC LIMIT 1) SELECT requisitionid,requisitioncreateddate," +
          "requisitionmodifieddate,startdate::date,enddate::date,code facilitycode,productcode,beginningbalance,quantityreceived,quantitydispensed," +
          "stockinhand,quantityrequested,normalizedconsumption,amc FROM Req " +
          "JOIN requisition_line_items li ON Req.requisitionid = li.rnrid"
      )
      .then(function(res) {
        resolve(res.rows);
      })
      .catch(function(err) {
        reject(err);
      });
  });
};

export { importDataValues };
