import React, { useEffect, useState } from 'react';
import MarketplaceCard from './MarketplaceCard';
import { Search, Filter } from 'lucide-react';
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
        const response = await fetch("http://localhost:8000/auctions");
        if (!response.ok) throw new Error("Failed to fetch auctions");

        const data = await response.json();
        setAuctions(data.auctions);
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
      {/* Search and Filter Section */}
      <div className="search-filter-container">
        <div className="search-bar">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search auctions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <button className="button filter-button">
          <Filter size={20} />
        </button>
      </div>

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
            startDate={auction.start_date}
            endDate={auction.end_date}
            predicted_score={auction.predicted_score}
            creator={auction.creator || "Unknown"}
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
