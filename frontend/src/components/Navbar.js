// src/components/Navbar.js

import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from './multiStepForm/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Link to="/">Carbon Credit Marketplace</Link>
      </div>
      <ul className="navbar-links">
        <li><Link to="/auctions">Auctions</Link></li>
        {token ? (
          <>
            <li><Link to="/profile">Profile</Link></li>
            <li><button onClick={handleLogout} className="logout-button">Logout</button></li>
          </>
        ) : (
          <>
            <li><Link to="/register">Register</Link></li>
            <li><Link to="/login">Login</Link></li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
