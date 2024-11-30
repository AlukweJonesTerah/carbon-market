import ReactDOM from "react-dom";
import React, { useState, useEffect, useContext } from "react";
import { RiCloseFill } from "react-icons/ri";
import { AuthContext } from "./AuthContext";
import "../../styles/AuctionModalList.css";

const formatDate = (dateString) => {
  if (!dateString || isNaN(new Date(dateString))) {
    return "Invalid Date";
  }
  const options = { year: "numeric", month: "long", day: "numeric" };
  const dateObj = new Date(dateString);
  return dateObj.toLocaleDateString(undefined, options);
};

export const AuctionModal = ({ auction, modalOpen, closeModal }) => {
  const { token } = useContext(AuthContext);
  const [bidValue, setBidValue] = useState(0);
  const [highestBid, setHighestBid] = useState("Loading...");
  const [bidCount, setBidCount] = useState(0);
  const [auctionDetails, setAuctionDetails] = useState(null);
  const [auctionFinished, setAuctionFinished] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Check if the auction has finished
  useEffect(() => {
    if (auction?.end_date) {
      const endDate = new Date(auction.end_date);
      const now = new Date();
      setAuctionFinished(now > endDate);
    }
  }, [auction?.end_date]);

  useEffect(() => {
    console.log("User from AuthContext:", token);
  }, [token]);

  // Fetch auction details
  const fetchAuctionDetails = async () => {
    setLoading(true);
    setError(null);
  
    try {
      const url = `http://localhost:8000/auction_details/${auction.id}`;
      console.log("Fetching auction details from URL:", url);
  
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      if (response.status === 404) {
        setError("Auction not found. It may have ended or been deleted.");
        return;
      }
  
      if (!response.ok) {
        throw new Error("Failed to fetch auction details");
      }
  
      const data = await response.json();
      setAuctionDetails(data.auction);
      setHighestBid(data.highest_bid?.bid_amount || "No bids yet");
      setBidCount(data.total_bids || 0);
    } catch (err) {
      console.error("Error fetching auction details:", err);
      setError(err.message || "Unable to load auction details. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Place a bid
const placeBid = async () => {
  if (!token) {
    setError("User information is missing. Please log in again.");
    return;
  }

  setError(null);
  setSuccessMessage(null);
  setSubmitting(true);

  // Validate bid value
  const numericBidValue = parseFloat(bidValue);
  if (isNaN(numericBidValue) || numericBidValue <= 0) {
    setError("Please enter a valid bid amount greater than 0");
    setSubmitting(false);
    return;
  }

  try {
    const response = await fetch("http://localhost:8000/place_bid/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        auction_id: auction.id,
        bidder: token, // Include the token as the bidder
        bid_amount: numericBidValue,
      }),
    });

    const result = await response.json();
    console.log("Server response:", result);

    if (!response.ok) {
      // Handle different error status codes
      switch (response.status) {
        case 400:
          throw new Error(result.detail || "Invalid bid");
        case 401:
          throw new Error("Your session has expired. Please log in again.");
        case 422:
          throw new Error(result.detail || "Invalid bid data");
        default:
          throw new Error(result.detail || "Failed to place bid");
      }
    }

    setSuccessMessage("Bid placed successfully!");
    setBidValue(""); // Reset bid value
    fetchAuctionDetails(); // Refresh auction details and bids
  } catch (err) {
    console.error("Error placing bid:", err);
    setError(err.message || "Failed to place bid. Please try again.");
  } finally {
    setSubmitting(false);
  }
};

  
  
  // Fetch data when modal opens
  useEffect(() => {
    if (modalOpen) fetchAuctionDetails();
  }, [modalOpen]);

  if (!modalOpen || !auctionDetails) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay open" onClick={closeModal}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{auctionDetails.title}</h2>
          <RiCloseFill size={24} onClick={closeModal} className="close-icon" />
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-spinner">Loading...</div>
          ) : (
            <>
              <div className="modal-image">
                {auctionDetails.satelliteImageUrl ? (
                  <img
                    src={auctionDetails.satelliteImageUrl}
                    alt="Auction item"
                    className="auction-image"
                  />
                ) : (
                  <div className="no-image">No Image Available</div>
                )}
              </div>

              <div className="modal-details">
                <p className="description">{auctionDetails.description}</p>

                <div className="details-list">
                  <div className="detail-item">
                    <span className="detail-label">Carbon Credits:</span>
                    <span className="detail-value">{auctionDetails.carbonCredit}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Carbon Offset Score:</span>
                    <span className="detail-value">{auctionDetails.predicted_score} tons</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Start Date:</span>
                    <span className="detail-value">{formatDate(auctionDetails.start_date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">End Date:</span>
                    <span className="detail-value">{formatDate(auctionDetails.end_date)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Creator CELO Address:</span>
                    <span className="detail-value">
                      {auctionDetails.creator_address
                        ? `${auctionDetails.creator_address.substring(0, 6)}...`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Starting Bid:</span>
                    <span className="detail-value">{auctionDetails.startingBid} CELO</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Current Highest Bid:</span>
                    <span className="detail-value">{highestBid} KES</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Total Bids:</span>
                    <span className="detail-value">{bidCount}</span>
                  </div>
                </div>

                {!auctionFinished && (
                  <div className="bidding-section">
                    <div className="bid-input-group">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Enter your bid"
                        className="bid-input"
                        value={bidValue}
                        onChange={(e) => {
                          console.log("New bid value:", e.target.value);
                          setBidValue(e.target.value);
                        }}
                        disabled={submitting}
                      />
                      <button
                        onClick={placeBid}
                        disabled={submitting || !bidValue || parseFloat(bidValue) <= 0 || !token}
                        className="button bid-button"
                      >
                        {submitting ? "Placing Bid..." : "Place Bid"}
                      </button>
                    </div>
                    {/* Debug information */}
                      <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                        <div>Current Auction ID: {auction?.id}</div>
                        <div>Bid Value: {bidValue}</div>
                        <div>Token Present: {token ? 'Yes' : 'No'}</div>
                      </div>
                  </div>
                )}

                {successMessage && (
                          <p className="success-message">
                            {successMessage}
                          </p>
                        )}
                  {error && (
                    <p className="error-message">
                      {typeof error === 'object' ? JSON.stringify(error) : error}
                    </p>
                  )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.getElementById("modal-root")
  );
};

export default AuctionModal;
