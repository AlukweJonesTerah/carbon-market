import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import './Register.css'; // Reusing the same CSS file for consistency
// import { AuthContext } from "./AuthContext";

const Login = ({ onLogin = () => {} }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // const { handleLogin } = useContext(AuthContsext); // Access handleLogin from AuthContext

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.access_token);
        // handleLogin(data.access_token, data.user);
        setMessage('Login successful!');
        setSuccess(true);
        onLogin(data.access_token);
        setUsername('');
        setPassword('');
        navigate('/');
      } else {
        setMessage(
          Array.isArray(data.detail)
            ? data.detail.map((err) => err.msg).join(', ')
            : data.detail || 'An unknown error occurred.'
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h1>Login</h1>
          <p>Enter your credentials to access your account</p>
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
            {/* <label htmlFor="password">Password</label> */}
            <input
              type="password"
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>

          {message && (
            <div className={`message ${success ? 'success' : 'error'}`}>
              {success ? <FiCheckCircle /> : <FiAlertCircle />}
              {message}
            </div>
          )}

          <button
            type="submit"
            className={`submit-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <button
            type="button"
            className="link-button"
            onClick={() => navigate('/register')}
          >
            Need an account? Register
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
