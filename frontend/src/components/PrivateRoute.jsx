import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";

/**
 * Renders its children only for an authenticated user; otherwise redirects to
 * /login.
 *
 * `replace` swaps the current history entry rather than pushing a new one, so
 * the back button doesn't bounce the user straight back to the page they were
 * just turned away from.
 *
 * There is no loading state to wait for: the token is read from localStorage
 * synchronously, before the first render, so `isAuthenticated` is already
 * correct here. The spinner branch this used to have was guarding an async read
 * that never happened.
 */
export default function PrivateRoute({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
