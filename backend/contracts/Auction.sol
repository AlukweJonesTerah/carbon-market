// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Auction {
    address payable public auctionCreator;
    uint256 public auctionEndTime;
    uint256 public minBidIncrement; // in basis points (e.g., 500 = 5%)
    uint256 public carbonCreditAmount;
    uint256 public maxBidAmount;

    address payable public highestBidder;
    uint256 public highestBid;

    mapping(address => uint256) public pendingReturns;

    bool public ended;

    event HighestBidIncreased(address bidder, uint256 amount);
    event AuctionEnded(address winner, uint256 amount);

    constructor(
        uint256 _biddingTime,
        uint256 _carbonCreditAmount,
        uint256 _maxBidAmount,
        uint256 _minBidIncrement,
        address payable _auctionCreator
    ) {
        auctionCreator = _auctionCreator;
        auctionEndTime = block.timestamp + _biddingTime;
        carbonCreditAmount = _carbonCreditAmount;
        maxBidAmount = _maxBidAmount;
        minBidIncrement = _minBidIncrement; // in basis points
    }

    function bid() public payable {
        require(block.timestamp <= auctionEndTime, "Auction already ended.");
        require(msg.value >= carbonCreditAmount, "Bid amount too low.");
        require(msg.value <= maxBidAmount, "Bid amount exceeds maximum limit.");

        uint256 minRequiredBid = highestBid + ((highestBid * minBidIncrement) / 10000);

        if (highestBid != 0) {
            require(msg.value >= minRequiredBid, "Bid not high enough.");
        }

        if (highestBid != 0) {
            // Refund the previous highest bidder
            pendingReturns[highestBidder] += highestBid;
        }

        highestBidder = payable(msg.sender);
        highestBid = msg.value;

        emit HighestBidIncreased(msg.sender, msg.value);
    }

    function withdraw() public {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "No funds to withdraw.");

        pendingReturns[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdrawal failed.");
    }

    function auctionEnd() public {
        require(block.timestamp >= auctionEndTime, "Auction not yet ended.");
        require(!ended, "auctionEnd already called.");

        ended = true;

        emit AuctionEnded(highestBidder, highestBid);

        // Transfer funds to the auction creator
        (bool success, ) = auctionCreator.call{value: highestBid}("");
        require(success, "Transfer to auction creator failed.");
    }
}
