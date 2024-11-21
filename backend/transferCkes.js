const Web3 = require('web3');
const { newKit } = require('@celo/contractkit');
require('dotenv').config();

const kit = newKit('https://alfajores-forno.celo-testnet.org');
const web3 = new Web3();

async function transferCkes(recipientAddress, weiAmount) {
    if (!web3.utils.isAddress(recipientAddress)) {
        console.error(JSON.stringify({ status: "error", error: "Invalid recipient address format." }));
        process.exit(1);
    }

    try {
        const FUNDING_ACCOUNT_PRIVATE_KEY = process.env.FUNDING_ACCOUNT_PRIVATE_KEY;
        if (!FUNDING_ACCOUNT_PRIVATE_KEY) {
            console.error(JSON.stringify({ status: "error", error: "Funding account private key not set" }));
            process.exit(1);
        }

        const fundingAccount = kit.web3.eth.accounts.privateKeyToAccount(FUNDING_ACCOUNT_PRIVATE_KEY);
        kit.addAccount(fundingAccount.privateKey);
        kit.defaultAccount = fundingAccount.address;

        const tx = await kit.sendTransaction({
            from: fundingAccount.address,
            to: recipientAddress,
            value: weiAmount,
        });

        await tx.waitReceipt();
        console.log(JSON.stringify({ status: "success", message: "Transaction complete" }));
        process.exit(0);

    } catch (error) {
        console.error(JSON.stringify({ status: "error", error: error.message || "Unknown error" }));
        process.exit(1);
    }
}

const recipientAddress = process.argv[2];
const weiAmount = process.argv[3];

if (!recipientAddress || !weiAmount) {
    console.error(JSON.stringify({ status: "error", error: "Recipient address and amount are required." }));
    process.exit(1);
}

transferCkes(recipientAddress, weiAmount);
