// AuctionCard.js

import React, { useEffect, useState, useContext } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import Jazzicon from "react-jazzicon";
import { AuthContext } from './AuthContext'; // Import AuthContext
import "../../styles/AuctionCard.css";

const AuctionCard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { token } = useContext(AuthContext); // Access token from AuthContext


  // State to hold auction data
  const [auctionData, setAuctionData] = useState(null);
  const [timeToFinish, setTimeToFinish] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);

  // State to hold creator's username
  const [creatorUsername, setCreatorUsername] = useState("Unknown");

  // Get the current user ID to check if they are the creator
  const [currentUserId, setCurrentUserId] = useState('');

  // Load auction data
  useEffect(() => {
    const fetchAuctionData = async () => {
      try {
        if (!token) {
          navigate('/Login', {
            state: {
              from: location.pathname,
            },
          });
          return;
        }

        const response = await fetch(`http://localhost:8000/auction/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('token');
            navigate('/Login', {
              state: {
                from: location.pathname,
              },
            });
            return;
          }
          throw new Error('Failed to fetch auction data');
        }

        const data = await response.json();
        setAuctionData(data);
      } catch (error) {
        console.error('Error fetching auction data:', error);
        setErrorMessage('Failed to load auction data');
      }
    };

    // If location.state is not provided, fetch data from backend
    if (!location.state) {
      fetchAuctionData();
    } else {
      setAuctionData(location.state);
    }
  }, [id, location.state, navigate]);

  // Fetch current user ID
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        if (!token) {
          navigate('/Login', {
            state: {
              from: location.pathname,
            },
          });
          return;
        }

        const response = await fetch(`http://localhost:8000/users/me`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setCurrentUserId(data._id);
        } else if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/Login', {
            state: {
              from: location.pathname,
            },
          });
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };

    fetchCurrentUser();
  }, [navigate]);

  // Fetch creator's username
  useEffect(() => {
    const fetchCreatorUsername = async () => {
      if (!auctionData?.creator_id) return;

      try {
        if (!token) {
          navigate('/Login', {
            state: {
              from: location.pathname,
            },
          });
          return;
        }

        const response = await fetch(`http://localhost:8000/users/${auctionData.creator_id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setCreatorUsername(data.username);
        } else if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/Login', {
            state: {
              from: location.pathname,
            },
          });
        }
      } catch (error) {
        console.error('Error fetching creator username:', error);
      }
    };

    fetchCreatorUsername();
  }, [auctionData?.creator_id, navigate]);

  // Destructure auction data
  const {
    title,
    map_url,
    description,
    carbon_credit_amount,
    start_date,
    end_date,
    predicted_score,
    creator_id,
  } = auctionData || {};

  // Calculate time remaining
  useEffect(() => {
    if (!end_date) {
      setTimeToFinish("No end date provided.");
      return;
    }

    const calculateTimeRemaining = () => {
      const endDate = new Date(end_date);
      const now = new Date();
      const timeDiff = endDate - now;

      if (timeDiff <= 0) {
        setTimeToFinish("Auction has ended.");
      } else {
        const totalMinutes = Math.floor(timeDiff / (1000 * 60));
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;

        setTimeToFinish(`${days}d ${hours}h ${minutes}m`);
      }
    };

    if (end_date) {
      calculateTimeRemaining();
      const interval = setInterval(calculateTimeRemaining, 60000);
      return () => clearInterval(interval);
    }
  }, [end_date]);

  // Handle Edit Button Click
  const handleEdit = () => {
    navigate(`/edit-auction/${id}`, { state: { auctionData } });
  };

  // Handle Bid Button Click
  const handlePlaceBid = () => {
    navigate(`/place-bid/${id}`, { state: { auctionData } });
  };

  return (
    <div className="auction-card">
        {errorMessage && <p className="error-message">{errorMessage}</p>}
  
        <div className="auction-image-container">
          {map_url ? (
            <img
              src={map_url}
              alt="Auction item"
              className="auction-image"
            />
          ) : (
            <div className="no-image">
              <span>No Image Available</span>
            </div>
          )}
          <div className="time-remaining">
            <label>{timeToFinish}</label>
          </div>
        </div>
  
        <div className="auction-details">
          <h1 className="auction-title">{title || "No title"}</h1>
          <p className="auction-description">{description || "No description"}</p>
        </div>
  
        <div className="creator-info">
          <Jazzicon diameter={30} seed={Math.round(Math.random() * 10000000)} />
          <label className="creator-username">{creatorUsername}</label>
        </div>
  
        <hr className="divider" />
  
        <div className="carbon-info">
          <p className="info-label info-value">
            Carbon Credits: {carbon_credit_amount || "N/A"}
          </p>
          <p className="info-label info-value">
            Carbon Offset Score: {predicted_score || "N/A"} Ton
          </p>
        </div>

        <div className="action-buttons">
          {currentUserId === creator_id && (
            <button onClick={handleEdit} className="edit-button">Edit Auction</button>
          )}
          <button onClick={handlePlaceBid} className="bid-button">Place Bid</button>
        </div>
    </div>
  );
  
};

export default AuctionCard;
