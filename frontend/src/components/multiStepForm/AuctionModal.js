import ReactDOM from "react-dom";
import React, { useState, useEffect, useContext } from "react";
import { RiCloseFill } from "react-icons/ri";
import Jazzicon from "react-jazzicon";
import { AuthContext } from "./AuthContext";
import "../../styles/AuctionModalList.css";

const formatDate = (dateString) => {
  const options = { year: "numeric", month: "long", day: "numeric" };
  const dateObj = new Date(dateString);
  return dateObj.toLocaleDateString(undefined, options);
};

export const AuctionModal = ({ auction, modalOpen, closeModal }) => {
  const { token } = useContext(AuthContext);
  const [bidValue, setBidValue] = useState(0);
  const [highestBid, setHighestBid] = useState(null);
  const [bidCount, setBidCount] = useState(0);
  const [auctionFinished, setAuctionFinished] = useState(false);

  useEffect(() => {
    const endDate = new Date(auction.end_date);
    const now = new Date();
    setAuctionFinished(now > endDate);
  }, [auction.end_date]);

  useEffect(() => {
    const fetchAuctionData = async () => {
      try {
        const response = await fetch(`http://localhost:8000/auction_details/${auction.id}`);
        const data = await response.json();
        setHighestBid(data.highest_bid?.bid_amount || "No bids yet");
        setBidCount(data.total_bids || 0);
      } catch (error) {
        console.error("Failed to fetch auction details", error);
      }
    };

    if (modalOpen) fetchAuctionData();
  }, [modalOpen, auction.id]);

  if (!modalOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay open" onClick={closeModal}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{auction.title}</h2>
          <RiCloseFill size={24} onClick={closeModal} className="close-icon" />
        </div>

        <div className="modal-body">
          <div className="modal-image">
            {auction.satelliteImageUrl ? (
              <img
                src={auction.satelliteImageUrl}
                alt="Auction item"
                className="auction-image"
              />
            ) : (
              <div className="no-image">No Image Available</div>
            )}
          </div>

          <div className="modal-details">
            <p className="description">{auction.description}</p>

            <div className="details-list">
              <div className="detail-item">
                <span className="detail-label">Carbon Credits:</span>
                <span className="detail-value">{auction.carbonCredit}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Carbon Offset Score:</span>
                <span className="detail-value">{auction.predicted_score} tons</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Start Date:</span>
                <span className="detail-value">{formatDate(auction.start_date)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">End Date:</span>
                <span className="detail-value">{formatDate(auction.end_date)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Starting Bid:</span>
                <span className="detail-value">{auction.startingBid || "N/A"} KES</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Current Highest Bid:</span>
                <span className="detail-value">{highestBid} KES</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Total Bids:</span>
                <span className="detail-value">{bidCount}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Creator:</span>
                <div className="creator-info">
                  <Jazzicon diameter={25} seed={Math.round(Math.random() * 10000000)} />
                  <span className="creator-name">
                    {auction.creator && typeof auction.creator === "string"
                      ? `${auction.creator.substring(0, 6)}...${auction.creator.substring(auction.creator.length - 4)}`
                      : "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            {!auctionFinished ? (
              <div className="bidding-section">
                <p className="highest-bid">
                  Highest Bid: {highestBid !== null ? highestBid : "Loading..."}
                </p>
                <div className="bid-input-group">
                  <input
                    type="number"
                    placeholder="Enter your bid"
                    className="bid-input"
                    value={bidValue}
                    onChange={(e) => setBidValue(e.target.value)}
                  />
                  <button
                    onClick={() => alert("Place Bid Clicked")} // Replace with your bid logic
                    disabled={bidValue <= 0}
                    className="button bid-button"
                  >
                    Place Bid
                  </button>
                </div>
              </div>
            ) : (
              <div className="auction-ended">
                <p>Auction has ended.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.getElementById("modal-root")
  );
};

export default AuctionModal;
