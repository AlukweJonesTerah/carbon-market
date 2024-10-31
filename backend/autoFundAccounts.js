require('dotenv').config();
const { newKit } = require('@celo/contractkit');
const Web3 = require('web3');

const kit = newKit('https://alfajores-forno.celo-testnet.org');
const web3 = new Web3('https://alfajores-forno.celo-testnet.org');

const MIN_BALANCE = web3.utils.toWei('1', 'ether');
const FUND_AMOUNT = '3000000000000000000'; // 3 CKES in wei
const FUNDING_ACCOUNT = process.env.FUNDING_ACCOUNT_PRIVATE_KEY;

// Verify that FUNDING_ACCOUNT_PRIVATE_KEY is loaded
if (!FUNDING_ACCOUNT) {
    console.log(JSON.stringify({ status: "error", error: "Funding account private key not set" }));
    process.exit(1);
}

async function autofundAccount(userAddress) {
    try {
        const fundingAccount = web3.eth.accounts.privateKeyToAccount(FUNDING_ACCOUNT);
        kit.web3.eth.accounts.wallet.add(fundingAccount);
        console.error("Funding account added to wallet:", fundingAccount.address);

        // Check user balance
        const balance = await web3.eth.getBalance(userAddress);
        console.error("User balance:", balance);

        if (BigInt(balance) < BigInt(MIN_BALANCE)) {
            const fundingAccountBalance = await web3.eth.getBalance(fundingAccount.address);
            console.error("Funding account balance:", fundingAccountBalance);

            if (BigInt(fundingAccountBalance) < BigInt(FUND_AMOUNT)) {
                console.log(JSON.stringify({ status: "low_funds" }));
                return;
            }

            // Fund the user account
            const tx = await kit.sendTransaction({
                from: fundingAccount.address,
                to: userAddress,
                value: FUND_AMOUNT,
            });

            await tx.waitReceipt();
            console.log(JSON.stringify({ status: "funded" }));
        } else {
            console.log(JSON.stringify({ status: "no_fund_needed" }));
        }
    } catch (error) {
        console.error("Error in autofundAccount.js:", error);
        console.log(JSON.stringify({ status: "error", error: error.message }));
        process.exit(1);
    }
}

// Get the user address from the command line argument and call autofundAccount
const userAddress = process.argv[2];
if (!userAddress) {
    console.log(JSON.stringify({ status: "error", error: "No user address provided" }));
    process.exit(1);
}
autofundAccount(userAddress);
