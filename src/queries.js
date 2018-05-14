const productQuery =
  "SELECT DISTINCT p.code," +
  "p.primaryname AS name, " +
  "p.dispensingunit, " +
  "d.code AS dosageunit," +
  "p.description," +
  "p.strength," +
  "pf.code AS form," +
  "RTRIM(LOWER(SUBSTRING(pg.name,1,3)), '') AS program," +
  "SUBSTRING(pg.code, 1, 3) AS programcode " +
  "FROM products p " +
  "INNER JOIN dosage_units d " +
  "ON p.dosageunitid = d.id " +
  "INNER JOIN program_products pp " +
  "ON p.id = pp.productid " +
  "INNER JOIN programs pg " +
  "ON pp.programid = pg.id " +
  "INNER JOIN product_forms pf " +
  "ON p.formid = pf.id;";

const productDataQuery =
  "SELECT " +
  "rqli.rnrid," +
  "rqli.productcode," +
  "rq.facilityid," +
  "fc.code facilitycode," +
  "fc.name facilityname," +
  "pp.name periodname," +
  "pp.numberofmonths," +
  "pp.startdate::DATE," +
  "pp.enddate::DATE," +
  "ps.code as shedulecode," +
  "ps.name as shedulename," +
  "rqli.quantityrequested" +
  "rqli.beginningbalance," +
  "rqli.stockinhand," +
  "rqli.stockoutdays," +
  "rqli.normalizedconsumption," +
  "rq.status,rq.emergency " +
  "FROM requisition_line_items rqli " +
  "INNER JOIN requisitions rq ON rq.id = rqli.rnrid " +
  "INNER JOIN facilities fc ON rq.facilityid = fc.id " +
  "INNER JOIN processing_periods pp ON rq.periodid = pp.id " +
  "INNER JOIN processing_schedules ps ON ps.id = pp.scheduleid " +
  "WHERE rqli.beginningbalance <> 0 AND rq.status IN( 'RELEASED','APPROVED','IN_APPROVAL') AND rq.emergency IS false";

export { productQuery, productDataQuery };
