// MarketplaceCard.js
import React, { useState, useEffect } from "react";
import Jazzicon from "react-jazzicon";
import { AuctionModal } from "./AuctionModal";
import { Clock, Leaf, User } from "lucide-react";
import "../../styles/MarketplaceCard.css";

const MarketplaceCard = ({
  id,
  title,
  satelliteImageUrl,
  description,
  carbonCredit,
  predicted_score,
  startDate,
  endDate,
  creator,
  creatorAddress,
  // startingBid,
  bidCount,
  highestBid,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timeToFinish, setTimeToFinish] = useState("");

  // Toggle Modal
  const toggleModal = () => setIsModalOpen(!isModalOpen);

  // Calculate Time Remaining
  useEffect(() => {
    if (!endDate) {
      setTimeToFinish("No end date");
      return;
    }

    const calculateTimeRemaining = () => {
      const end = new Date(endDate);
      const now = new Date();
      const timeDiff = end - now;

      if (timeDiff <= 0) {
        setTimeToFinish("Auction ended");
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

  return (
    <div className="marketplace-card">
      <div className="image-container">
        {satelliteImageUrl ? (
          <img src={satelliteImageUrl} alt="Auction item" className="satellite-image" />
        ) : (
          <div className="no-image">No Image Available</div>
        )}
        <div className="time-remaining">
          <Clock size={16} strokeWidth={2} className="mr-1" /> {timeToFinish}
        </div>
      </div>

      <div className="details">
        <h1 className="title">{title}</h1>
        <p className="description">{description}</p>
      </div>

      {/* Creator Info */}
      <div className="creator-info-container">
        <div className="creator-info">
          <Jazzicon diameter={35} seed={Math.round(Math.random() * 10000000)} />
          <div className="creator-details">
            <User size={18} strokeWidth={2} />
            <span className="creator-name">{creator}</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <hr className="divider" />

      <div className="carbon-info">
        <p className="carbon-credit">
          <Leaf size={16} strokeWidth={2} className="inline-block mr-1 text-green-500" />
          Carbon Credits: {carbonCredit}
        </p>
        <p className="carbon-score">Score: {predicted_score} Ton</p>
        {/* <p className="starting-bid">Starting Bid: {startingBid} KES</p> */}
        <p className="bid-count">Total Bids: {bidCount}</p>
        <button onClick={toggleModal} className="button">
          See More
        </button>
      </div>

      {isModalOpen && (
        <AuctionModal
          auction={{
            id,
            title,
            satelliteImageUrl,
            description,
            carbonCredit,
            predicted_score,
            startDate,
            endDate,
            creator,
            creatorAddress,
            // startingBid,
            bidCount,
            highestBid,
          }}
          modalOpen={isModalOpen}
          closeModal={toggleModal}
        />
      )}
    </div>
  );
};

export default MarketplaceCard;
