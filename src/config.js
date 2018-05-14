import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const requestHeaders = {
  "Content-Type": "application/json",
  Authorization:
    "Basic " + new Buffer(process.env.CREDENTIALS).toString("base64")
};

const rootUrl = process.env.URL;

// Connect to ELMIS DATABASE
const dbClient = new pg.Client({
  user: process.env.ELMIS_DB_USER || "",
  host: process.env.ELMIS_DB_HOST || "",
  database: process.env.ELMIS_DB_NAME || "",
  password: process.env.ELMIS_DB_PASS || "",
  port: process.env.ELMIS_DB_PORT || ""
});

export { requestHeaders, rootUrl, dbClient };
