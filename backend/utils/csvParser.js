/**
 * csvParser.js — Legacy compatibility shim.
 * The full parsing logic (CSV + PDF) has been moved to utils/parser.js.
 * This file re-exports parseStatementFile so existing requires keep working.
 */
const { parseStatementFile } = require("./parser");

module.exports = parseStatementFile;