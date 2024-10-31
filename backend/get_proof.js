import { create} from '@web3-storage/w3up-client';

async function getProof() {
  // Create a new client instance
  const client = await create();

  // Generate a new signer (key pair)
//   const signer = await ed25519.generate();

  // Add the space to the client and set it as current
  const spaceDid = await client.addSpace(signer);
  await client.setCurrentSpace(spaceDid);
  console.log('Space DID:', spaceDid.toString());

  // Register the space by providing your email
  await client.registerSpace({ email: 'your-email@example.com' });
  console.log('Registration email sent. Please check your inbox.');

  // Wait for the space registration to complete
  await client.waitSpaceRegistered(spaceDid);
  console.log('Space registered successfully!');

  // Retrieve the new proof
  const proofs = await client.proofs();
  console.log('Proofs:', proofs);
}

getProof().catch(console.error);
