import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import './Register.css';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [celoAddress, setCeloAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateForm = () => {
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return false;
    }
    if (password.length < 8) {
      setMessage('Password must be at least 8 characters long');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!validateForm()) return;
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.toLowerCase().trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Registration successful!');
        setCeloAddress(data.celoAddress);
        setUsername('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        handleErrors(response, data);
      }
    } catch (error) {
      console.error('Error during registration:', error);
      setMessage('An error occurred during registration. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleErrors = (response, data) => {
    if (response.status === 400 || response.status === 422) {
      if (data.detail) {
        if (Array.isArray(data.detail)) {
          setMessage(`Registration failed: ${data.detail.map((err) => err.msg).join(', ')}`);
        } else {
          setMessage(`Registration failed: ${data.detail}`);
        }
      } else {
        setMessage('Registration failed: Unknown error');
      }
    } else {
      setMessage('Registration failed: Unexpected error occurred');
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h1>Create an Account</h1>
          <p>Register to start using our platform</p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            {/* <label htmlFor="username">Username</label> */}
            <input
              type="text"
              id="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            {/* <label htmlFor="email">Email</label> */}
            <input
              type="email"
              id="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            {/* <label htmlFor="password">Password <small style={{ color: '#6b7280' }}>(min. 8 characters)</small></label> */}
            <input
              type="password"
              id="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>

          <div className="form-group">
            {/* <label htmlFor="confirmPassword">Confirm Password</label> */}
            <input
              type="password"
              id="confirmPassword"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>

          {message && (
            <div className={`message ${celoAddress ? 'success' : 'error'}`}>
              {celoAddress ? <FiCheckCircle /> : <FiAlertCircle />}
              {message}
            </div>
          )}

          {celoAddress && (
            <div className="celo-address">
              <strong>Your Celo Address:</strong>
              <span className="address-text">{celoAddress}</span>
            </div>
          )}

          <button 
            type="submit" 
            className={`submit-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>

          <button 
            type="button"
            className="link-button"
            onClick={() => navigate('/login')}
          >
            Already have an account? Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

export default Register;
