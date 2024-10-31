import React, { useEffect, useState } from 'react';
import MarketplaceCard from './MarketplaceCard';

const AuctionList = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) return <div className="text-center text-gray-600 py-4">Loading auctions...</div>;
  if (error) return <div className="text-center text-red-500 py-4">Error: {error}</div>;
  if (auctions.length === 0) return <div className="text-center text-gray-600 py-4">No auctions available at the moment.</div>;

  return (
    <div className="flex overflow-x-auto space-x-6 snap-x snap-mandatory py-4 px-4 bg-gray-100 rounded-lg shadow-md">
      {auctions.map((auction) => (
        <div key={auction._id} className="snap-start flex-shrink-0">
          <MarketplaceCard
            id={auction._id}
            title={auction.title}
            satelliteImageUrl={auction.map_url}
            description={auction.description}
            carbonCredit={auction.carbon_credit_amount}
            start_date={auction.start_date}
            end_date={auction.end_date}
            predicted_score={auction.predicted_score}
            creator={auction.creator || "Unknown"}
          />
        </div>
      ))}
    </div>
  );
};

export default AuctionList;
