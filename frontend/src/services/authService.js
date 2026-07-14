import http from "./HttpClient.js";

// auth: "none" — a stale token must not be sent along with a login attempt.
export function registerUser(userData) {
  return http.post("/api/auth/register", userData, { auth: "none" });
}

export function loginUser(credentials) {
  return http.post("/api/auth/login", credentials, { auth: "none" });
}
