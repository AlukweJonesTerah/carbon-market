import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import './Register.css'; // Reusing the same CSS for consistent styling

function RecoverAccount() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRecover = async (e) => {
    e.preventDefault();
    setMessage('');
    setSuccess(false);
    setMnemonic('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:8000/recover/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setMnemonic(data.mnemonic);
        setSuccess(true);
        setUsername('');
        setPassword('');
      } else {
        setMessage(data.detail || 'An error occurred during account recovery.');
      }
    } catch (error) {
      console.error('Recovery error:', error);
      setMessage('An unexpected error occurred. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h1>Recover Account</h1>
          <p>Enter your credentials to recover your mnemonic</p>
        </div>

        <form onSubmit={handleRecover} className="register-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
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
            <label htmlFor="password">Password</label>
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

          {mnemonic && (
            <div className="celo-address">
              <strong>Your Mnemonic Phrase:</strong>
              <span className="address-text">{mnemonic}</span>
            </div>
          )}

          <button
            type="submit"
            className={`submit-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? 'Recovering...' : 'Recover Account'}
          </button>

          <button
            type="button"
            className="link-button"
            onClick={() => navigate('/login')}
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default RecoverAccount;
