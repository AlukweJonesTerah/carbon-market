import React, { createContext, useState } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const existingToken = localStorage.getItem('token');
  const [token, setToken] = useState(existingToken);

  const handleLogin = (accessToken) => {
    setToken(accessToken);
    localStorage.setItem('token', accessToken);
  };

  const logout = () => {
    setToken(null);  // Clear the token from state
    localStorage.removeItem('token');  // Remove the token from local storage
  };

  return (
    <AuthContext.Provider value={{ token, handleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
