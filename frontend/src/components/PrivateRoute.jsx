// client/src/components/PrivateRoute.jsx

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "./Spinner";

/**
 * A wrapper component that protects routes requiring authentication.
 * If the user is authenticated, it renders the child components.
 * If not, it redirects the user to the login page.
 * It also handles the initial loading state of the authentication context.
 *
 * @param {object} props - The component's props.
 * @param {React.ReactNode} props.children - The child components to render if authenticated.
 * @returns {React.ReactElement} Either the children or a Navigate component.
 */
const PrivateRoute = ({ children }) => {
  // 3. Consume the authentication context
  // We get the user's authentication status and the loading state.
  const { isAuthenticated, isLoading } = useAuth();

  // 4. Handle the loading state
  // While the AuthContext is checking for a token in localStorage,
  // we don't want to render anything or make a redirect decision yet.
  // This prevents a logged-in user from being briefly redirected to /login
  // on a page refresh before the context has initialized.
  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // 5. Make the access control decision
  // If the user is authenticated, we render the 'children' that were passed
  // to this component. This is the protected content (e.g., the DashboardPage).
  if (isAuthenticated) {
    return children;
  }

  // 6. If the user is not authenticated, redirect them
  // The <Navigate> component declaratively redirects the user.
  // The 'replace' prop is crucial for good user experience. It replaces
  // the current entry in the history stack instead of pushing a new one.
  // This means the user can't click the browser's "back" button to get
  // back to the page they were redirected from (the protected route).
  return <Navigate to="/login" replace />;
};

export default PrivateRoute;
