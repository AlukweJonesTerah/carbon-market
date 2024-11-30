// Navbar.js
import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from './multiStepForm/AuthContext'; // Correct import
import './Navbar.css';

const Navbar = () => {
  const { token, handleLogout } = useContext(AuthContext);  // Destructure handleLogout here
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    handleLogout();  // Call handleLogout function from context
    navigate('/login');  // Navigate to the login page after logout
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
            <li><button onClick={handleLogoutClick} className="logout-button">Logout</button></li>
            <li><Link to="/explain_calculation">ExplainCalculation</Link></li>
          </>
        ) : (
          <>
            <li><Link to="/explain_calculation">ExplainCalculation</Link></li>
            <li><Link to="/register">Register</Link></li>
            <li><Link to="/login">Login</Link></li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
