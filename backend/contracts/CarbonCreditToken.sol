// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title CarbonCreditToken
 * @dev Implementation of a Carbon Credit Token with extended functionality
 */
contract CarbonCreditToken is ERC20, Ownable, Pausable, ERC20Burnable {
    // Events
    event CreditsMinted(address indexed to, uint256 amount, string projectId);
    event CreditsRetired(address indexed from, uint256 amount, string reason);
    event ProjectRegistered(string projectId, string metadata);

    // Structs
    struct Project {
        bool isRegistered;
        string metadata;
        uint256 totalCreditsIssued;
    }

    // State variables
    mapping(string => Project) public projects;
    mapping(address => bool) public verifiers;
    uint256 public totalRetiredCredits;

    constructor(uint256 initialSupply) ERC20("CarbonCreditToken", "CCT") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    // Modifiers
    modifier onlyVerifier() {
        require(verifiers[msg.sender], "Caller is not a verified entity");
        _;
    }

    // Admin functions
    function addVerifier(address verifier) external onlyOwner {
        verifiers[verifier] = true;
    }

    function removeVerifier(address verifier) external onlyOwner {
        verifiers[verifier] = false;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Project management
    function registerProject(string calldata projectId, string calldata metadata) external onlyVerifier {
        require(!projects[projectId].isRegistered, "Project already registered");
        
        projects[projectId] = Project({
            isRegistered: true,
            metadata: metadata,
            totalCreditsIssued: 0
        });

        emit ProjectRegistered(projectId, metadata);
    }

    // Minting functions
    function mintCredits(address to, uint256 amount, string calldata projectId) external onlyVerifier whenNotPaused {
        require(projects[projectId].isRegistered, "Project not registered");
        
        _mint(to, amount);
        projects[projectId].totalCreditsIssued += amount;
        
        emit CreditsMinted(to, amount, projectId);
    }

    // Retirement functions
    function retireCredits(uint256 amount, string calldata reason) external whenNotPaused {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        _burn(msg.sender, amount);
        totalRetiredCredits += amount;
        
        emit CreditsRetired(msg.sender, amount, reason);
    }

    // View functions
    function getProjectDetails(string calldata projectId) external view returns (bool isRegistered, string memory metadata, uint256 totalCreditsIssued) {
        Project memory project = projects[projectId];
        return (project.isRegistered, project.metadata, project.totalCreditsIssued);
    }

    // Override transfer functions to add pausable functionality
    function transfer(address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }
}