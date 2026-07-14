import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";

const baseLinkClass = "font-mono text-[13px] text-muted transition-colors duration-100 hover:text-fg";

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    isActive ? `${baseLinkClass} text-fg` : baseLinkClass;

  return (
    <header className="topnav">
      <div className="container topnav-inner">
        <NavLink to="/" className="logo">
          <span className="prompt">$</span>trunc.sh
        </NavLink>
        <nav>
          <NavLink to="/shorten" end className={linkClass}>
            /shorten
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/dashboard" className={linkClass}>
              /dashboard
            </NavLink>
          )}
          <NavLink to="/mcp" className={linkClass}>
            /mcp
          </NavLink>
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleLogout}
              className={baseLinkClass}
            >
              /logout
            </button>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                /login
              </NavLink>
              <NavLink to="/register" className={linkClass}>
                /register
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
