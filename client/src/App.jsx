import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./AuthContext.jsx";
import PrivateRoute from "./PrivateRoute.jsx";

import LandingPage from "./LandingPage.jsx";
import Scan from "./Scan.jsx";
import History from "./History.jsx";
import Profile from "./Profile.jsx";
import About from "./About.jsx";
import Contact from "./Contact.jsx";
import Login from "./Login.jsx";
import Register from "./Register.jsx";

/* ---------------- Menu Dropdown Navbar (NON-OVERLAY) ---------------- */
/* Key change: menu is NOT absolute anymore, so it never covers the hero.
   When opened, it expands the navbar area and pushes page content down. */

function useClickOutside(ref, onOutside) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [ref, onOutside]);
}

function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const navRef = useRef(null);

  useClickOutside(navRef, () => setOpen(false));

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const links = useMemo(
    () =>
      [
        { to: "/", label: "Home" },
        { to: "/scan", label: "Scan" },
        { to: "/history", label: "History", private: true },
        { to: "/profile", label: "Profile", private: true },
        { to: "/about", label: "About" },
        { to: "/contact", label: "Contact" },
      ].filter((l) => (l.private ? user : true)),
    [user]
  );

  const isActive = (to) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const itemBase =
    "block w-full text-left rounded-xl px-5 py-3.5 text-[15px] leading-relaxed font-semibold transition";
  const itemActive = "bg-[rgba(38,199,102,0.16)] text-[#0f3d2a]";
  const itemIdle = "text-[#0f3d2a]/85 hover:bg-black/5";

  return (
    <div
      ref={navRef}
      className="sticky top-0 z-50 border-b border-black/10 bg-[rgba(38,199,102,0.12)] backdrop-blur"
    >
      <div className="mx-auto max-w-6xl px-4 py-3">
        {/* Top row */}
        <div className="flex items-center gap-10 sm:gap-12">
          {/* Menu button */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="px-4 py-2.5 rounded-xl text-sm font-extrabold bg-white/70 border border-black/10 text-[#0f3d2a] hover:bg-white transition"
            aria-expanded={open}
            aria-controls="ps-menu"
          >
            Menu <span className="ml-1" aria-hidden="true">▾</span>
          </button>

          {/* Brand (spacing + line-height so it never feels cramped) */}
          <NavLink to="/" className="leading-none">
            <div className="text-xl font-extrabold tracking-tight text-[#0f3d2a] leading-tight">
              PestiScan
            </div>
            <div className="mt-1 text-[11px] text-black/50 tracking-widest leading-snug">
              SMART PESTICIDE RISK DETECTION
            </div>
          </NavLink>
        </div>

        {/* Dropdown (in-flow, pushes content down; no overlap) */}
        {open ? (
          <div
            id="ps-menu"
            className="mt-3 rounded-2xl border border-black/10 bg-white/92 backdrop-blur shadow-sm"
          >
            <div className="p-2">
              <div className="space-y-2">
                {links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={() =>
                      [itemBase, isActive(l.to) ? itemActive : itemIdle].join(" ")
                    }
                  >
                    {l.label}
                  </NavLink>
                ))}
              </div>

              <div className="my-2.5 h-px bg-black/10" />

              <div className="space-y-2">
                {user ? (
                  <button
                    onClick={logout}
                    className={[
                      itemBase,
                      itemIdle,
                      "text-[#0f3d2a] bg-transparent",
                    ].join(" ")}
                  >
                    Logout
                  </button>
                ) : (
                  <>
                    <NavLink
                      to="/login"
                      className={() =>
                        [itemBase, isActive("/login") ? itemActive : itemIdle].join(
                          " "
                        )
                      }
                    >
                      Login
                    </NavLink>
                    <NavLink
                      to="/register"
                      className={() =>
                        [
                          itemBase,
                          isActive("/register") ? itemActive : itemIdle,
                        ].join(" ")
                      }
                    >
                      Register
                    </NavLink>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- App ---------------- */

export default function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Dynamic agriculture background layer */}
        <div className="min-h-screen relative overflow-hidden">
          {/* animated soft blobs */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            {/* base gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[rgba(38,199,102,0.14)] via-[rgba(255,244,204,0.14)] to-[rgba(133,205,255,0.12)]" />

            {/* blob 1 (leaf green) */}
            <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-[rgba(38,199,102,0.22)] blur-3xl animate-[psFloat1_10s_ease-in-out_infinite]" />

            {/* blob 2 (soil/warm sun) */}
            <div className="absolute top-40 -right-32 h-[520px] w-[520px] rounded-full bg-[rgba(245,191,90,0.18)] blur-3xl animate-[psFloat2_12s_ease-in-out_infinite]" />

            {/* blob 3 (sky/water) */}
            <div className="absolute -bottom-40 left-1/3 h-[520px] w-[520px] rounded-full bg-[rgba(80,170,255,0.14)] blur-3xl animate-[psFloat3_14s_ease-in-out_infinite]" />
          </div>

          <Navbar />

          <div className="text-[#0f3d2a]">
            <div className="mx-auto max-w-6xl px-4 py-6">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/scan" element={<Scan />} />

                <Route
                  path="/history"
                  element={
                    <PrivateRoute>
                      <History />
                    </PrivateRoute>
                  }
                />

                <Route
                  path="/profile"
                  element={
                    <PrivateRoute>
                      <Profile />
                    </PrivateRoute>
                  }
                />

                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Routes>
            </div>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}
