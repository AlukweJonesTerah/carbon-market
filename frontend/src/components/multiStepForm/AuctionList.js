// AuctionList.js
import React, { useEffect, useState } from 'react';
import MarketplaceCard from './MarketplaceCard';
import { Search } from 'lucide-react';
import "../../styles/MarketplaceCard.css";

const AuctionList = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAuctions, setFilteredAuctions] = useState([]);

  // Fetch Auctions
  useEffect(() => {
    const fetchAuctions = async () => {
      try {
        const response = await fetch("http://localhost:8000/auctions/");
        if (!response.ok) throw new Error("Failed to fetch auctions");

        const data = await response.json();
        // Sort auctions by created_at or end_date in descending order
        const sortedAuctions = data.auctions.sort(
          (a, b) => new Date(b.created_at || b.end_date) - new Date(a.created_at || a.end_date)
        );
        setAuctions(sortedAuctions);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAuctions();
  }, []);

  // Filter Auctions
  useEffect(() => {
    const filtered = auctions.filter((auction) =>
      auction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      auction.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredAuctions(filtered);
  }, [searchTerm, auctions]);

  // Handle Loading State
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Handle Error State
  if (error) {
    return (
      <div className="text-center text-red-500 py-4 bg-red-50 rounded-lg">
        <p className="font-semibold">Error Fetching Auctions</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Handle No Auctions State
  if (auctions.length === 0) {
    return (
      <div className="text-center text-gray-600 py-4 bg-gray-50 rounded-lg">
        <p className="font-semibold">No Auctions Available</p>
        <p className="text-sm">Check back later for new auctions.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Search Section */}
      <div className="search-filter-container">
        <div className="search-bar">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search auctions..."
            value={searchTerm}
            onChange={(e) => {
              const trimmedValue = e.target.value.trimStart();
              if (trimmedValue !== "") {
                setSearchTerm(trimmedValue);
              } else {
                setSearchTerm("");
              }
            }}
            className="search-input"
          />
        </div>
      </div>

     {/* Auction Grid */}
      {/* Auction Grid */}
      <div className="auction-grid">
        {filteredAuctions.map((auction) => (
          <MarketplaceCard
            key={auction._id}
            id={auction._id}
            title={auction.title}
            satelliteImageUrl={auction.map_url}
            description={auction.description}
            carbonCredit={auction.carbon_credit_amount}
            predicted_score={auction.predicted_score}
            startDate={auction.start_date}
            endDate={auction.end_date}
            creator={
              auction.creator_info.celoAddress
                ? auction.creator_info.celoAddress.substring(0, 6)
                : "Unknown"
            }
            creatorAddress={
              auction.creator_info.celoAddress
                ? auction.creator_info.celoAddress.substring(0, 6)
                : "Unknown"
            }
            startingBid={auction.starting_bid || "N/A"}
            bidCount={auction.bid_count || 0}
            highestBid={auction.highest_bid || "No bids yet"}
          />
        ))}
      </div>


      {/* No Results Handling */}
      {filteredAuctions.length === 0 && (
        <div className="no-results">
          <p>No auctions match your search. Try adjusting your search terms.</p>
        </div>
      )}
    </div>
  );
};

export default AuctionList;
