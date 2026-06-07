const DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const dashboardCache = new Map();

const normalizeUserKey = (userId) => String(userId || "");

const getDashboardCache = (userId) => {
  const key = normalizeUserKey(userId);
  if (!key) return null;

  const entry = dashboardCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.ts >= DASHBOARD_CACHE_TTL_MS) {
    dashboardCache.delete(key);
    return null;
  }

  return entry.payload;
};

const setDashboardCache = (userId, payload) => {
  const key = normalizeUserKey(userId);
  if (!key) return;
  dashboardCache.set(key, { ts: Date.now(), payload });
};

const invalidateDashboardCache = (userId) => {
  const key = normalizeUserKey(userId);
  if (!key) return;
  dashboardCache.delete(key);
};

module.exports = {
  getDashboardCache,
  setDashboardCache,
  invalidateDashboardCache,
};
