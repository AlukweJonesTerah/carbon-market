// frontend/src/utils/api.js

export const createAuction = async (auctionData) => {
  try {
    const response = await fetch("http://0.0.0.0:8000/create_auction/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(auctionData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error in createAuction:", errorData);
      throw new Error(`Failed to create auction: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error in createAuction:", error);
    throw error; // Re-throw the error for handling elsewhere
  }
};

export const processCoordinates = async (coords) => {
  try {
    const response = await fetch("http://0.0.0.0:8000/process_coordinates/", {  // Update here
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coordinates: coords }),
    });

    if (!response.ok) {
      throw new Error("Failed to process coordinates");
    }

    const data = await response.json();
    return data; // Contains predicted_score and map_url
  } catch (error) {
    console.error(error);
  }
};
