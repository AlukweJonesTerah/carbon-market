// AuctionModal.js

import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-hot-toast";
import { RiCloseFill } from "react-icons/ri";
import Jazzicon from "react-jazzicon";
import { AuthContext } from './AuthContext'
import { useNavigate } from 'react-router-dom';


// Helper function to format dates
const formatDate = (dateString) => {
  const options = { year: "numeric", month: "long", day: "numeric" };
  const dateObj = new Date(dateString);
  return dateObj.toLocaleDateString(undefined, options);
};

export const AuctionModal = ({ auction, modalOpen, closeModal }) => {
  const { token } = useContext(AuthContext);
  const [bidValue, setBidValue] = useState(0);
  const navigate = useNavigate();
  const [additionalData, setAdditionalData] = useState(null);
  const [error, setError] = useState(null);
  const [highestBid, setHighestBid] = useState(null); // State for highest bid
  const [auctionFinished, setAuctionFinished] = useState(false);

  // Check if auction is finished
  useEffect(() => {
    const endDate = new Date(auction.end_date);
    const now = new Date();
    setAuctionFinished(now > endDate);
  }, [auction.end_date]);

  // Fetch the highest bid when the modal opens
  useEffect(() => {
    const fetchHighestBid = async () => {
      try {
        const response = await fetch(`http://localhost:8000/highest_bid/${auction.id}`);
        const data = await response.json();
        if (data.highest_bid) {
          setHighestBid(data.highest_bid.bid_amount);
        } else {
          setHighestBid("No bids yet");
        }
      } catch (error) {
        toast.error("Failed to fetch the highest bid");
      }
    };

    if (modalOpen) {
      fetchHighestBid();
    }
  }, [modalOpen, auction.id]);

  // Handle placing bid
  const handleBid = async () => {
    if (bidValue <= 0) {
      toast.error("Bid must be greater than 0.");
      return;
    }
    
    try {
      const response = await fetch("http://localhost:8000/place_bid/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auction_id: auction.id,
          bidder: "user_address_here", // Replace with user wallet address
          bid_amount: parseFloat(bidValue),
        }),
      });

      if (!response.ok) throw new Error("Failed to place bid");

      toast.success(`Bid of ${bidValue} placed successfully`);
      closeModal();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Format dates for display
  const formattedStartDate = formatDate(auction.start_date);
  const formattedEndDate = formatDate(auction.end_date);

  return (
    <div className={`${modalOpen ? "modal-background" : "hidden"}`}>
  <div className="modal-container">
    {/* Modal Header */}
    <div className="modal-header">
      <h1 className="modal-title">Auction Details</h1>
      <RiCloseFill size={24} onClick={closeModal} className="close-icon" />
    </div>

    {/* Modal Content */}
    <div className="modal-content">
      {/* Left Side - Auction Details */}
      <div className="auction-details">
        <h2>{auction.title}</h2>
        <p className="text-gray-600">{auction.description}</p>

        <div className="space-y-4 mt-4">
          <div>
            <span className="detail-label">Carbon Credits</span>
            <p className="detail-value">{auction.carbonCredit}</p>
          </div>
          <div>
            <span className="detail-label">Carbon Offset Score</span>
            <p className="detail-value">{auction.predicted_score} tons</p>
          </div>
          <div className="flex items-center">
            <span className="detail-label mr-2">Creator</span>
            <Jazzicon diameter={25} seed={Math.round(Math.random() * 10000000)} />
            <p className="detail-value ml-2">
              {auction.creator && typeof auction.creator === "string"
                ? `${auction.creator.substring(0, 6)}...${auction.creator.substring(auction.creator.length - 4)}`
                : "Unknown"}
            </p>
          </div>
          <div>
            <span className="detail-label">Start Date</span>
            <p className="detail-value">{formattedStartDate}</p>
          </div>
          <div>
            <span className="detail-label">End Date</span>
            <p className="detail-value">{formattedEndDate}</p>
          </div>
        </div>
      </div>

      {/* Right Side - Auction Image */}
      <div className="flex justify-center">
        {auction.satelliteImageUrl ? (
          <img
            src={auction.satelliteImageUrl}
            alt="Auction item"
            className="rounded-xl object-cover w-80 h-80"
          />
        ) : (
          <div className="bg-gray-200 w-80 h-80 rounded-xl flex items-center justify-center">
            <span>No Image Available</span>
          </div>
        )}
      </div>
    </div>

    {/* Divider */}
    <div className="h-[2px] my-4 bg-gray-300"></div>

    {/* Bidding Section */}
    {!auctionFinished ? (
      <div className="bidding-section">
        <label className="font-semibold">Place your bid</label>
        <div className="bid-input-container">
          <p className="highest-bid">Highest Bid: {highestBid !== null ? highestBid : "Loading..."}</p>
          <input
            type="number"
            placeholder="Enter bid value"
            className="bid-input"
            value={bidValue}
            onChange={(e) => setBidValue(Number(e.target.value))}
          />
          <button
            onClick={handleBid}
            disabled={bidValue <= 0}
            className="bid-button"
          >
            Place Bid
          </button>
        </div>
      </div>
    ) : (
      <div className="auction-ended">Auction has ended.</div>
    )}
  </div>
</div>

  );
};

export default AuctionModal;
