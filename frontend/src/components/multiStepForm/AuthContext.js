// AuthContext.js

import React, { createContext, useState } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const existingToken = localStorage.getItem('token');
  const [token, setToken] = useState(existingToken);

  const handleLogin = (accessToken) => {
    setToken(accessToken);
    localStorage.setItem('token', accessToken);
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
  };

  const setAuthToken = (token) => {
    if (token) {
      localStorage.setItem('token', token);
      setToken(token);
    } else {
      localStorage.removeItem('token');
      setToken(null);
    }
  };

  return (
    <AuthContext.Provider value={{ token, setAuthToken, handleLogin, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
};
