import React, { useEffect, useState } from 'react';
import './Register.css'; // Reusing the same CSS
import { FiLogOut, FiAlertCircle } from 'react-icons/fi'; // Added FiAlertCircle import
import { useNavigate } from 'react-router-dom';

function Profile() {
  const [profileData, setProfileData] = useState(null);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      navigate('/login');
    } else {
      fetchProfile();
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setProfileData(data);
      } else {
        setMessage(data.detail || 'Failed to fetch profile data.');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setMessage('An unexpected error occurred. Please try again later.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (message) {
    return (
      <div className="register-container">
        <div className="register-card">
          <div className="message error">
            <FiAlertCircle /> {/* Using FiAlertCircle for error messages */}
            {message}
          </div>
          <button
            type="button"
            className="submit-button"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="register-container">
        <div className="register-card">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h1>Profile</h1>
          <button className="link-button" onClick={handleLogout}>
            <FiLogOut /> Logout
          </button>
        </div>

        <div className="register-form">
          <div className="form-group">
            <label>Username:</label>
            <p>{profileData.username}</p>
          </div>

          <div className="form-group">
            <label>Email:</label>
            <p>{profileData.email}</p>
          </div>

          <div className="form-group">
            <label>Celo Address:</label>
            <p className="address-text">{profileData.celoAddress}</p>
          </div>

          <div className="form-group">
            <label>CELO Balance:</label>
            <p>{profileData.celoBalance} CELO</p>
          </div>

          <div className="form-group">
            <label>Balance in USD:</label>
            <p>{profileData.balance_usd}</p>
          </div>

          <div className="form-group">
            <label>Balance in KES:</label>
            <p>{profileData.balance_kes}</p>
          </div>

          <div className="form-group">
            <label>Fund Status:</label>
            <p>{profileData.fund_status}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
