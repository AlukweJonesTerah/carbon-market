// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./CarbonCreditToken.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract CarbonCreditAuction is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    
    CarbonCreditToken public carbonToken;
    Counters.Counter private _auctionIds;
    
    uint256 public constant MINIMUM_AUCTION_DURATION = 1 days;
    uint256 public constant MAXIMUM_AUCTION_DURATION = 30 days;
    
    struct Auction {
        uint256 id;
        address creator;
        uint256 carbonCreditAmount;
        uint256 minBid;
        uint256 maxBid;
        uint256 startTime;
        uint256 endTime;
        address highestBidder;
        uint256 highestBid;
        bool finalized;
        string ipfsHash;
    }
    
    mapping(uint256 => Auction) public auctions;
    mapping(uint256 => mapping(address => uint256)) public bids;
    mapping(address => uint256[]) public userAuctions;
    
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed creator,
        uint256 carbonCreditAmount,
        uint256 minBid,
        uint256 maxBid,
        uint256 startTime,
        uint256 endTime,
        string ipfsHash
    );
    
    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );
    
    event AuctionFinalized(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 winningBid
    );
    
    constructor(address _carbonTokenAddress) Ownable(msg.sender) {
        require(_carbonTokenAddress != address(0), "Invalid token address");
        carbonToken = CarbonCreditToken(_carbonTokenAddress);
    }
    
    function createAuction(
        uint256 carbonCreditAmount,
        uint256 minBid,
        uint256 maxBid,
        uint256 startTime,
        uint256 endTime,
        string calldata ipfsHash
    ) external nonReentrant returns (uint256) {
        require(startTime > block.timestamp, "Start time must be in future");
        require(endTime > startTime, "End time must be after start time");
        require(endTime - startTime >= MINIMUM_AUCTION_DURATION, "Auction duration too short");
        require(endTime - startTime <= MAXIMUM_AUCTION_DURATION, "Auction duration too long");
        require(carbonCreditAmount > 0, "Carbon credit amount must be positive");
        require(maxBid > minBid, "Max bid must be greater than min bid");
        require(bytes(ipfsHash).length > 0, "IPFS hash required");
        
        // Ensure creator has approved enough tokens
        require(
            carbonToken.allowance(msg.sender, address(this)) >= carbonCreditAmount,
            "Insufficient token allowance"
        );
        
        // Transfer carbon credits to contract
        require(
            carbonToken.transferFrom(msg.sender, address(this), carbonCreditAmount),
            "Carbon credit transfer failed"
        );
        
        _auctionIds.increment();
        uint256 newAuctionId = _auctionIds.current();
        
        Auction storage auction = auctions[newAuctionId];
        auction.id = newAuctionId;
        auction.creator = msg.sender;
        auction.carbonCreditAmount = carbonCreditAmount;
        auction.minBid = minBid;
        auction.maxBid = maxBid;
        auction.startTime = startTime;
        auction.endTime = endTime;
        auction.ipfsHash = ipfsHash;
        
        userAuctions[msg.sender].push(newAuctionId);
        
        emit AuctionCreated(
            newAuctionId,
            msg.sender,
            carbonCreditAmount,
            minBid,
            maxBid,
            startTime,
            endTime,
            ipfsHash
        );
        
        return newAuctionId;
    }
    
    function placeBid(uint256 auctionId) external payable nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.creator != address(0), "Auction does not exist");
        require(block.timestamp >= auction.startTime, "Auction not started");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(!auction.finalized, "Auction already finalized");
        require(msg.sender != auction.creator, "Creator cannot bid");
        require(msg.value >= auction.minBid, "Bid too low");
        require(msg.value <= auction.maxBid, "Bid too high");
        require(msg.value > auction.highestBid, "Bid not high enough");
        
        // Refund previous highest bidder
        if (auction.highestBidder != address(0) && auction.highestBidder != msg.sender) {
            (bool refundSuccess, ) = auction.highestBidder.call{value: auction.highestBid}("");
            require(refundSuccess, "Failed to refund previous bidder");
        }
        
        auction.highestBidder = msg.sender;
        auction.highestBid = msg.value;
        bids[auctionId][msg.sender] = msg.value;
        
        emit BidPlaced(auctionId, msg.sender, msg.value);
    }
    
    function cancelAuction(uint256 auctionId) external nonReentrant {
    Auction storage auction = auctions[auctionId];
    require(msg.sender == auction.creator, "Only creator can cancel");
    require(block.timestamp < auction.startTime, "Cannot cancel after start");

    auction.finalized = true;
    
    require(carbonToken.transfer(auction.creator, auction.carbonCreditAmount), "Token transfer failed");

    emit AuctionFinalized(auctionId, address(0), 0);  // No winner, no winning bid
    }

    function finalizeAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.creator != address(0), "Auction does not exist");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(!auction.finalized, "Auction already finalized");
        
        auction.finalized = true;
        
        if (auction.highestBidder != address(0)) {
            // Transfer carbon credits to winner
            require(
                carbonToken.transfer(auction.highestBidder, auction.carbonCreditAmount),
                "Failed to transfer carbon credits"
            );
            
            // Transfer funds to creator
            (bool success, ) = auction.creator.call{value: auction.highestBid}("");
            require(success, "Failed to transfer funds to creator");
            
            emit AuctionFinalized(auctionId, auction.highestBidder, auction.highestBid);
        } else {
            // Return carbon credits to creator if no bids
            require(
                carbonToken.transfer(auction.creator, auction.carbonCreditAmount),
                "Failed to return carbon credits"
            );
        }
    }
    
    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        require(auctions[auctionId].creator != address(0), "Auction does not exist");
        return auctions[auctionId];
    }
    
    function getUserAuctions(address user) external view returns (uint256[] memory) {
        return userAuctions[user];
    }
    
    // Emergency function to recover stuck tokens
    function emergencyTokenRecovery(address token, uint256 amount) external onlyOwner {
        require(token != address(carbonToken), "Cannot withdraw auction tokens");
        IERC20(token).transfer(owner(), amount);
    }
    
    // Emergency function to recover stuck ETH
    function emergencyETHRecovery() external onlyOwner {
        require(address(this).balance > 0, "No ETH to recover");
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "ETH recovery failed");
    }
    
    // To receive ETH from refunds
    receive() external payable {}
    fallback() external payable {}
}