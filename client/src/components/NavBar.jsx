import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getNotifications } from "../api";
import Logo from "./Logo";

export default function NavBar() {
  const { pathname } = useLocation();
  const [user, setUser] = useState(() => localStorage.getItem("fairnest_user"));
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("fairnest_user");
    setUser(stored);
    if (!stored) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    const load = () =>
      getNotifications()
        .then((res) => {
          if (!cancelled) setUnread(res.unread);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  const me = (() => {
    try {
      return JSON.parse(user || "{}");
    } catch {
      return {};
    }
  })();
  const isOwner = me.role === "owner";

  return (
    <header className="fn-header">
      <div className="container d-flex align-items-center justify-content-between py-3">
        <Logo />
        <nav className="d-flex align-items-center gap-3">
          <Link to="/" className={`fn-nav-link ${pathname === "/" ? "active" : ""}`}>
            Find PG
          </Link>
          <Link
            to="/roommates"
            className={`fn-nav-link ${pathname === "/roommates" ? "active" : ""}`}
          >
            Roommates
          </Link>

          {isOwner ? (
            <>
              <Link
                to="/owner/add"
                className={`fn-nav-link ${pathname === "/owner/add" ? "active" : ""}`}
              >
                + Add Property
              </Link>
              <Link
                to="/owner"
                className={`fn-nav-link ${pathname === "/owner" ? "active" : ""}`}
              >
                Owner Dashboard
              </Link>
            </>
          ) : (
            <Link
              to="/dashboard"
              className={`fn-nav-link ${pathname === "/dashboard" ? "active" : ""}`}
            >
              Dashboard
            </Link>
          )}

          {user && unread > 0 && (
            <span className="fn-notif-badge" title="Notifications">
              {unread}
            </span>
          )}

          <Link
            to="/auth"
            className={`btn btn-primary btn-sm px-3 ${pathname === "/auth" ? "active" : ""}`}
          >
            {user ? "Account" : "Log in"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
