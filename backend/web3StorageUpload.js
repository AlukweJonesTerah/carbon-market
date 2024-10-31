// web3StorageUpload.js

const { Web3Storage } = require('@web3-storage/w3up-client');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// The new API uses space DID and proof instead of an API token
const SPACE_DID = process.env.SPACE_DID;
const PROOF = process.env.PROOF;

async function makeStorageClient() {
    if (!SPACE_DID || !PROOF) {
        throw new Error("Space DID and proof are required. Please set the SPACE_DID and PROOF environment variables.");
    }

    // Create and authorize the client
    const client = await Web3Storage.create();
    await client.login();  // This will authenticate using your browser
    
    // Load the space using the DID
    const space = await client.addSpace(SPACE_DID);
    await space.provision(PROOF);
    
    return client;
}

async function uploadFile(filePath) {
    const client = await makeStorageClient();
    
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    // Create a CAR file for the content
    const { car } = await client.uploadFile({
        name: fileName,
        content: fileBuffer
    });

    // Get the root CID
    const cid = car.root.toString();
    
    return `https://${cid}.ipfs.dweb.link/${fileName}`;
}

// Run the script
(async () => {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error("Please specify a file path as an argument.");
        process.exit(1);
    }
    
    try {
        const url = await uploadFile(filePath);
        console.log(url);
    } catch (error) {
        console.error("Error uploading file to Web3.Storage:", error);
        process.exit(1);
    }
})();