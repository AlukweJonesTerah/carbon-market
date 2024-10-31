const { newKit } = require('@celo/contractkit');
require('dotenv').config();

const kit = newKit('https://alfajores-forno.celo-testnet.org');

async function transferCkes(recipientAddress, weiAmount) {
    try {
        const FUNDING_ACCOUNT_PRIVATE_KEY = process.env.FUNDING_ACCOUNT_PRIVATE_KEY;
        
        // Check for private key presence
        if (!FUNDING_ACCOUNT_PRIVATE_KEY) {
            console.error(JSON.stringify({ status: "error", error: "Funding account private key not set" }));
            process.exit(1);
        }

        // Add funding account to kit
        const fundingAccount = kit.web3.eth.accounts.privateKeyToAccount(FUNDING_ACCOUNT_PRIVATE_KEY);
        kit.addAccount(fundingAccount.privateKey);
        kit.defaultAccount = fundingAccount.address;

        // Send transaction
        const tx = await kit.sendTransaction({
            from: fundingAccount.address,
            to: recipientAddress,
            value: weiAmount,
        });

        // Await transaction receipt and confirm success
        await tx.waitReceipt();
        console.log(JSON.stringify({ status: "success", message: "Transaction complete" }));
        process.exit(0);

    } catch (error) {
        console.error(JSON.stringify({ status: "error", error: error.message }));
        process.exit(1);
    }
}

// Collect command-line arguments for recipient address and amount
const recipientAddress = process.argv[2];
const weiAmount = process.argv[3];

// Verify recipient address and wei amount are provided
if (!recipientAddress || !weiAmount) {
    console.error(JSON.stringify({ status: "error", error: "Recipient address and amount are required." }));
    process.exit(1);
}

// Call transfer function with provided inputs
transferCkes(recipientAddress, weiAmount);
