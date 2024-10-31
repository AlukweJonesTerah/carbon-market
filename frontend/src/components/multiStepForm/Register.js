// frontend/src/Register.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(''); // For any success or error messages
  const [celoAddress, setCeloAddress] = useState(''); // Store the Celo address
  const navigate = useNavigate();

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); // Clear any previous messages

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
        setCeloAddress(data.celoAddress); // Store the Celo address returned by the backend

        // Optional: Clear form fields on successful registration
        setUsername('');
        setEmail('');
        setPassword('');

        // Redirect to login after a short delay
        setTimeout(() => navigate('/login'), 2000);
      } else {
        handleErrors(response, data);
      }
    } catch (error) {
      console.error('Error during registration:', error);
      setMessage('An error occurred during registration. Please try again later.');
    }
  };

  const handleErrors = (response, data) => {
    if (response.status === 400 || response.status === 422) {
      if (data.detail) {
        // Handle validation errors from the backend
        if (Array.isArray(data.detail)) {
          const errorMessages = data.detail.map((err) => err.msg).join(', ');
          setMessage(`Registration failed: ${errorMessages}`);
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
    <div style={{ maxWidth: '400px', margin: 'auto' }}>
      <h1>Register</h1>

      {/* Display success or error messages */}
      {message && <p style={{ color: celoAddress ? 'green' : 'red' }}>{message}</p>}

      {/* Display Celo address if registration is successful */}
      {celoAddress && (
        <p>
          <strong>Your Celo Address:</strong> {celoAddress}
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            required
          />
        </div>

        <button type="submit">Register</button>
      </form>
    </div>
  );
}

export default Register;
