import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getNotifications, getChatsUnread } from "../api";
import { FaRegSun, FaRegMoon } from "react-icons/fa6";
import Logo from "./Logo";

export default function NavBar() {
  const { pathname } = useLocation();
  const [user, setUser] = useState(() => localStorage.getItem("mynest_user"));
  const [unread, setUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Color theme: saved choice wins, otherwise follow the OS preference.
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("mynest_theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mynest_theme", theme);
  }, [theme]);

  // Soft shadow once the page scrolls — gives the sticky header depth.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false); // navigating always closes the mobile menu
    const stored = localStorage.getItem("mynest_user");
    setUser(stored);
    if (!stored) {
      setUnread(0);
      setMsgUnread(0);
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
    // Chat badge rides alongside (cheap count query, same rhythm).
    const loadMsgs = () =>
      getChatsUnread()
        .then((res) => {
          if (!cancelled) setMsgUnread(res.unread);
        })
        .catch(() => {});
    loadMsgs();
    const id2 = setInterval(loadMsgs, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearInterval(id2);
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
    <header className={`fn-header${scrolled ? " fn-header-scrolled" : ""}`}>
      <div className="container d-flex align-items-center justify-content-between py-3">
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="fn-theme-toggle"
            role="switch"
            aria-checked={theme === "dark"}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            <span className="fn-theme-track-ico" aria-hidden="true"><FaRegSun /></span>
            <span className="fn-theme-track-ico" aria-hidden="true"><FaRegMoon /></span>
            <span className="fn-theme-knob" aria-hidden="true">
              {theme === "dark" ? <FaRegMoon /> : <FaRegSun />}
            </span>
          </button>
          <Logo />
        </div>
        <button
          type="button"
          className={`fn-menu-btn${menuOpen ? " open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav className={`fn-nav d-flex align-items-center gap-3${menuOpen ? " open" : ""}`}>
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
            to="/chats"
            className={`fn-nav-link ${pathname === "/chats" ? "active" : ""}`}
          >
            Chats
          </Link>
          {user && msgUnread > 0 && (
            <span className="fn-notif-badge" title="Unread chats">
              {msgUnread}
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
