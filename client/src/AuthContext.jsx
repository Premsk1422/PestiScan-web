import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";

const AuthCtx = createContext();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("ps_token") || "");

  // decode JWT to get user info
  const user = useMemo(() => {
    if (!token) return null;
    try {
      return jwtDecode(token);
    } catch {
      return null;
    }
  }, [token]);

  function login(newToken) {
    setToken(newToken);
    localStorage.setItem("ps_token", newToken);
  }

  function logout() {
    setToken("");
    localStorage.removeItem("ps_token");
  }

  // unique key for storing history per user
  function historyKey() {
    return user ? `history_${user.id}` : "history_guest";
  }

  return (
    <AuthCtx.Provider value={{ token, user, login, logout, historyKey }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
