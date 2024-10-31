const bip39 = require('bip39');
const { newKit } = require('@celo/contractkit');
const fs = require('fs');
require('dotenv').config();

async function createCeloAccount() {
    try {
        const kit = newKit('https://alfajores-forno.celo-testnet.org');  // Celo Alfajores testnet

        // Generate a new mnemonic
        const mnemonic = bip39.generateMnemonic();

        // Generate account using the mnemonic
        const account = kit.web3.eth.accounts.create();

        // Save the mnemonic to a file with restricted permissions
        fs.writeFileSync('mnemonic.txt', mnemonic, { mode: 0o600 });

        // Fund the account with 3 CKES
        const funded = await fundAccount(kit, account.address, '3000000000000000000'); // 3 CKES in wei
        if (!funded) {
            console.error("Account creation halted due to funding failure.");
            process.exit(1);
        }

        const output = {
            mnemonic: mnemonic,
            address: account.address,
            privateKey: account.privateKey
        };

        // Save account details to generatedAccounts.json
        let accounts = [];
        if (fs.existsSync('generatedAccounts.json')) {
            accounts = JSON.parse(fs.readFileSync('generatedAccounts.json'));
        }
        accounts.push(output);
        fs.writeFileSync('generatedAccounts.json', JSON.stringify(accounts, null, 2));

        // Output JSON-formatted result
        console.log(JSON.stringify(output)); // Final output in JSON format only
        return output;
    } catch (error) {
        console.error('Error generating Celo account:', error);
        process.exit(1);
    }
}

// Function to fund a newly created account
async function fundAccount(kit, recipientAddress, amount) {
    try {

        const fundingKey = process.env.FUNDING_PRIVATE_KEY;
        if (!fundingKey) {
            throw new Error("FUNDING_PRIVATE_KEY is not set in the environment variables.");
        }
        
        const fundingAccount = kit.web3.eth.accounts.privateKeyToAccount(process.env.FUNDING_PRIVATE_KEY);
        kit.web3.eth.accounts.wallet.add(fundingAccount);
        kit.defaultAccount = fundingAccount.address;

        const tx = await kit.sendTransaction({
            from: fundingAccount.address,
            to: recipientAddress,
            value: amount,
        });

        const receipt = await tx.waitReceipt();
        return true;
    } catch (error) {
        console.error('Error funding account:', error);
        return false;
    }
}

// Run the function if called directly
if (require.main === module) {
    createCeloAccount().catch(console.error);
}

// Export the createCeloAccount function
module.exports = createCeloAccount;
