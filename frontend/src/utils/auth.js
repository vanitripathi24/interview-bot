// Decodes the JWT payload WITHOUT verifying the signature — this is only
// for deciding what to show in the UI (e.g. a "Recruiter Dashboard" link).
// Real authorization always happens server-side via requireAdmin middleware,
// so a tampered token here can't grant actual access to anything.
export function getCurrentUser() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

export function isAdmin() {
  return getCurrentUser()?.role === "admin";
}
