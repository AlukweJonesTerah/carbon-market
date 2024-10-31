// frontend/src/components/multiStepForm/Login.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = ({ onLogin = () => {} }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false); // Track login success status
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(""); // Clear message on each submit
    setSuccess(false); // Reset success state

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'  },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Login successful
        localStorage.setItem('token', data.access_token);
        setMessage("Login successful!");
        setSuccess(true);
        onLogin(data.access_token);

        // Clear form fields
        setUsername('');
        setPassword('');

        // Redirect to home or dashboard
        navigate('/');
      } else {
        // Handle error messages from backend
        if (Array.isArray(data.detail)) {
          const errorMessages = data.detail.map((err) => err.msg).join(', ');
          setMessage(errorMessages);
        } else if (typeof data.detail === 'string') {
          setMessage(data.detail);
        } else {
          setMessage('An unknown error occurred.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage('An error occurred during login. Please try again.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: 'auto' }}>
      <h1>Login</h1>
      {message && <p style={{ color: success ? 'green' : 'red' }}>{message}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default Login;
