import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // Initialize state and set token from localStorage if available
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    // Sync localStorage with state
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }, [token]);

  const handleLogin = (accessToken) => {
    setToken(accessToken);
  };

  const handleLogout = () => {
    setToken(null);
  };

  const setAuthToken = (token) => {
    setToken(token);
  };

  return (
    <AuthContext.Provider value={{ token, setAuthToken, handleLogin, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};
