/**
 * DATE NORMALIZER
 * Supports formats:
 *   - DD/MM/YYYY, DD-MM-YYYY
 *   - YYYY-MM-DD (ISO)
 *   - DD MMM YYYY (e.g. 15 Jan 2024)
 *   - MMM DD, YYYY (e.g. Jan 15, 2024)
 *   - DD/MM/YY, MM/DD/YYYY
 *   - Unix timestamps (numbers)
 *   - Native JS Date strings
 */

const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6,
  august: 7, september: 8, october: 9, november: 10, december: 11,
};

/**
 * Parse a date value into a JS Date object.
 * Returns fallbackDate if parsing fails.
 *
 * @param {string|number|Date|null} value
 * @param {Date} [fallbackDate=new Date()]
 * @returns {Date}
 */
const parseDate = (value, fallbackDate = new Date()) => {
  if (value instanceof Date && !isNaN(value)) return value;
  if (value === null || value === undefined || value === "") return fallbackDate;

  // Unix timestamp (seconds or ms)
  if (typeof value === "number") {
    const ms = value > 1e10 ? value : value * 1000;
    const d = new Date(ms);
    return isNaN(d) ? fallbackDate : d;
  }

  const raw = String(value).trim();

  // ── DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!isNaN(d) && d.getFullYear() >= 2000) return d;
  }

  // ── DD/MM/YY (2-digit year)
  const ddmmyy = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (ddmmyy) {
    const [, dd, mm, yy] = ddmmyy;
    const yyyy = Number(yy) > 50 ? 1900 + Number(yy) : 2000 + Number(yy);
    const d = new Date(yyyy, Number(mm) - 1, Number(dd));
    if (!isNaN(d)) return d;
  }

  // ── YYYY/MM/DD or YYYY-MM-DD
  const yyyymmdd = raw.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (yyyymmdd) {
    const [, yyyy, mm, dd] = yyyymmdd;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if (!isNaN(d) && d.getFullYear() >= 2000) return d;
  }

  // ── DD MMM YYYY (e.g. "15 Jan 2024")
  const ddMMMYYYY = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
  if (ddMMMYYYY) {
    const [, dd, mon, yyyy] = ddMMMYYYY;
    const monthIdx = MONTH_MAP[mon.toLowerCase()];
    if (monthIdx !== undefined) {
      const d = new Date(Number(yyyy), monthIdx, Number(dd));
      if (!isNaN(d)) return d;
    }
  }

  // ── MMM DD, YYYY (e.g. "Jan 15, 2024")
  const MMMddYYYY = raw.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (MMMddYYYY) {
    const [, mon, dd, yyyy] = MMMddYYYY;
    const monthIdx = MONTH_MAP[mon.toLowerCase()];
    if (monthIdx !== undefined) {
      const d = new Date(Number(yyyy), monthIdx, Number(dd));
      if (!isNaN(d)) return d;
    }
  }

  // ── PhonePe / Paytm formats like "Mar 15, 2024, 10:30 AM"
  const phonePeDate = raw.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/);
  if (phonePeDate) {
    const [, mon, dd, yyyy] = phonePeDate;
    const monthIdx = MONTH_MAP[mon.toLowerCase()];
    if (monthIdx !== undefined) {
      const d = new Date(Number(yyyy), monthIdx, Number(dd));
      if (!isNaN(d)) return d;
    }
  }

  // ── Date + Time like "2024-01-15 10:30:00"
  const dateTime = raw.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})/);
  if (dateTime) {
    const [, yyyy, mm, dd, hh, min] = dateTime;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min));
    if (!isNaN(d)) return d;
  }

  // ── DD-Mon-YYYY (SBI format like "01-Jan-2024") ──
  const ddMonDashYYYY = raw.match(/^(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})$/);
  if (ddMonDashYYYY) {
    const [, dd, mon, yyyy] = ddMonDashYYYY;
    const monthIdx = MONTH_MAP[mon.toLowerCase()];
    if (monthIdx !== undefined) {
      const d = new Date(Number(yyyy), monthIdx, Number(dd));
      if (!isNaN(d)) return d;
    }
  }

  // ── OCR noisy formats: "1 5/01/2024" or "01/ 15/2024" ──
  const noisyDate = raw.match(/^(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})$/);
  if (noisyDate) {
    let [, part1, part2, part3] = noisyDate;
    const year = Number(part3) < 100 ? 2000 + Number(part3) : Number(part3);
    // Assume DD/MM/YYYY (Indian format)
    const d = new Date(year, Number(part2) - 1, Number(part1));
    if (!isNaN(d) && d.getFullYear() >= 2000) return d;
  }

  // ── Try native parse LAST (handles ISO 8601 and strings cleanly)
  const nativeParse = new Date(raw);
  if (!isNaN(nativeParse)) {
    const yr = nativeParse.getFullYear();
    if (yr >= 2000 && yr <= 2100) return nativeParse;
  }

  return fallbackDate;
};

/**
 * Format a Date as YYYY-MM string (for grouping by month)
 * @param {Date} date
 * @returns {string}
 */
const toYearMonth = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

module.exports = { parseDate, toYearMonth };
