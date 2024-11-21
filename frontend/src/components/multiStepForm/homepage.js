// src/components/multiStepForm/homepage.js

import React, { useState } from 'react';
import { 
  MapPin, 
  Leaf, 
  DollarSign, 
  TrendingUp, 
  Shield, 
  Clock 
} from 'lucide-react';
import "../../styles/App.css";
import heroImage from '../../assets/hero-image.jpg'; // Import your hero image

const LandingPage = () => {
  const [email, setEmail] = useState('');

  const features = [
    {
      icon: <MapPin />,
      title: "Location-Based Auctions",
      description: "Bid on carbon credit projects from specific geographic regions."
    },
    {
      icon: <Leaf />,
      title: "Verified Carbon Credits",
      description: "Only authenticated and verified carbon reduction initiatives."
    },
    {
      icon: <DollarSign />,
      title: "Transparent Pricing",
      description: "Real-time market pricing and open bidding process."
    }
  ];

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement email submission logic
    console.log('Submitted email:', email);
  };

  return (
    <div className="landing-page">
      <header className="hero-section">
        <div 
          className="hero-image" 
          style={{ backgroundImage: `url(${heroImage})` }}
          role="img" 
          aria-label="Hero background image depicting sustainability"
        >
          <div className="hero-content">
            <h1>Invest in a Greener Future</h1>
            <p>Join our marketplace to trade carbon credits and support sustainable projects.</p>
            
            <form onSubmit={handleEmailSubmit} className="email-signup">
              <input 
                type="email" 
                placeholder="Enter your email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit">Get Started</button>
            </form>
          </div>
        </div>
      </header>

      <section className="features-section">
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card">
              <div className="feature-icon">{feature.icon}</div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="process-section">
        <h2>How It Works</h2>
        <div className="process-steps">
          <div className="process-step">
            <TrendingUp />
            <h3>Explore Projects</h3>
            <p>Browse verified carbon reduction initiatives worldwide.</p>
          </div>
          <div className="process-step">
            <Shield />
            <h3>Place Bids</h3>
            <p>Participate in transparent carbon credit auctions.</p>
          </div>
          <div className="process-step">
            <Clock />
            <h3>Track Impact</h3>
            <p>Monitor your contribution to global sustainability.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
