import http from "./HttpClient.js";

/**
 * These previously took a `token` argument that every caller had to thread down
 * from AuthContext. HttpClient reads it from the token store instead, so the
 * pages no longer pass credentials around.
 */
export function getUserLinks() {
  return http.get("/api/links/my-links", { auth: "required" });
}

export function getClicksByDay(days = 30) {
  return http.get(`/api/links/clicks-by-day?days=${days}`, { auth: "required" });
}

export function getOverview() {
  return http.get("/api/links/overview", { auth: "required" });
}
