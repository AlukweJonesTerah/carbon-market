// src/App.js

import React, { useState, useContext } from "react";
import "./App.css";
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import AuctionForm from './components/multiStepForm/AuctionForm';
import CoordinateForm from './components/multiStepForm/CoordinateForm';
import AuctionCard from './components/multiStepForm/AuctionCard';
import AuctionList from './components/multiStepForm/AuctionList';
import Register from './components/multiStepForm/Register';
import Login from './components/multiStepForm/Login';
import AccountRecovery from './components/multiStepForm/AccountRecovery';
import Profile from './components/multiStepForm/Profile';
import UserInfo from './components/multiStepForm/UserInfo';
import LandingPage from './components/multiStepForm/homepage';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, AuthContext } from './components/multiStepForm/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

function App() {
  const [coordinates, setCoordinates] = useState(null);
  const [predictedScore, setPredictedScore] = useState(null);

  const handleCoordinatesSubmit = (coords, score) => {
    setCoordinates(coords);
    setPredictedScore(score);
  };

  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navbar />
          <div className="App-content">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/coordinates" element={<CoordinateForm onNext={handleCoordinatesSubmit} />} />
              <Route path="/create-auction" element={<PrivateRoute coordinates={coordinates} predictedScore={predictedScore} />} />
              <Route path="/auction-card/:id" element={<AuctionCard />} />
              <Route path="/auctions" element={<AuctionList />} />
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/recover" element={<AccountRecovery />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/me" element={<UserInfo />} />
              {/* <Route path="/authentication" element={<Authentication />} /> */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            <Toaster />
          </div>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

// PrivateRoute component for handling protected routes
function PrivateRoute({ coordinates, predictedScore }) {
  const { token } = useContext(AuthContext);

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
