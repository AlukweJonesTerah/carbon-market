import React, { useEffect, useState } from "react";
import Jazzicon from "react-jazzicon";
import { AuctionModal } from "./AuctionModal";
import { useNavigate, useLocation } from "react-router-dom";
import "../../styles/MarketplaceCard.css"; // Import the CSS file

const MarketplaceCard = ({
  id,
  title = "No title",
  satelliteImageUrl = "",
  description = "No description",
  carbonCredit = "N/A",
  predicted_score = "N/A",
  startDate,
  endDate,
  creator = "Unknown",
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeToFinish, setTimeToFinish] = useState("");

  // Toggle the modal
  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  // Open modal if redirected back from login
  useEffect(() => {
    if (location.state?.openModal && location.state?.auctionId === id) {
      setIsModalOpen(true);
    }
  }, [location.state, id]);

  // Calculate time remaining
  useEffect(() => {
    if (!endDate) {
      setTimeToFinish("No end date provided.");
      return;
    }

    const calculateTimeRemaining = () => {
      const end = new Date(endDate);
      const now = new Date();
      const timeDiff = end - now;

      if (timeDiff <= 0) {
        setTimeToFinish("Auction has ended.");
      } else {
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((timeDiff / 1000 / 60) % 60);
        setTimeToFinish(`${days}d ${hours}h ${minutes}m`);
      }
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 60000);
    return () => clearInterval(interval);
  }, [endDate]);

  // Display creator
  const displayCreator = () => {
    if (creator && typeof creator === "string") {
      if (creator.length > 10) {
        return `${creator.substring(0, 6)}...${creator.substring(creator.length - 4)}`;
      } else {
        return creator;
      }
    } else {
      return "Unknown";
    }
  };

  return (
    <div className="marketplace-card">
      <div className="image-container">
        {satelliteImageUrl ? (
          <img src={satelliteImageUrl} alt="Auction item" className="satellite-image" />
        ) : (
          <div className="no-image">No Image Available</div>
        )}
        <div className="time-remaining">
          <label>{timeToFinish}</label>
        </div>
      </div>

      <div className="details">
        <h1 className="title">{title}</h1>
        <p className="description">{description}</p>
      </div>

      <div className="creator-info">
        <Jazzicon diameter={25} seed={Math.round(Math.random() * 10000000)} />
        <label className="creator-name">{displayCreator()}</label>
      </div>

      <hr className="divider" />

      <div className="carbon-info">
        <div>
          <p className="carbon-credit">Carbon Credits: {carbonCredit}</p>
          <p className="carbon-score">Carbon Credits Score: {predicted_score} Ton</p>
        </div>
        <button onClick={toggleModal} className="see-more-button">See more</button>
      </div>

      {isModalOpen && (
        <AuctionModal
          auction={{ id, title, satelliteImageUrl, description, carbonCredit, predicted_score, startDate, endDate, creator }}
          modalOpen={isModalOpen}
          closeModal={toggleModal}
        />
      )}
    </div>
  );
};

export default MarketplaceCard;
