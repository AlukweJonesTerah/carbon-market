// frontend/src/App.js

import React, { useState, useContext } from "react";
import "./App.css";
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import AuctionForm from './components/multiStepForm/AuctionForm';
import CoordinateForm from './components/multiStepForm/CoordinateForm';
import AuctionCard from './components/multiStepForm/AuctionCard';
import AuctionList from './components/multiStepForm/AuctionList';
import Register from './components/multiStepForm/Register';
import Login from './components/multiStepForm/Login';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, AuthContext } from './components/multiStepForm/AuthContext';  // Import AuthProvider and AuthContext

function App() {
  const [coordinates, setCoordinates] = useState(null);
  const [predictedScore, setPredictedScore] = useState(null);

  const handleCoordinatesSubmit = (coords, score) => {
    setCoordinates(coords);
    setPredictedScore(score);
  };

  return (
    <AuthProvider> {/* Wrap the app in AuthProvider */}
      <div className="App">
        <header className="App-header">
          <h1>Carbon Credit Prediction</h1>
          <p>Enter the coordinates of your preservation area below:</p>
          <Router>
            <Routes>
              <Route path="/coordinates" element={<CoordinateForm onNext={handleCoordinatesSubmit} />} />
              <Route path="/create-auction" element={<PrivateRoute coordinates={coordinates} predictedScore={predictedScore} />} />
              <Route path="/auction-card/:id" element={<AuctionCard />} />
              <Route path="/auctions" element={<AuctionList />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Navigate to="/coordinates" />} />
            </Routes>
          </Router>
          <Toaster />
        </header>
      </div>
    </AuthProvider>
  );
}

// PrivateRoute component for handling protected routes
function PrivateRoute({ coordinates, predictedScore }) {
  const { token } = useContext(AuthContext); // Access token from AuthContext

  return token ? (
    coordinates ? (
      <AuctionForm coordinates={coordinates} predictedScore={predictedScore} />
    ) : (
      <Navigate to="/coordinates" />
    )
  ) : (
    <Navigate to="/login" />
  );
}

export default App;
