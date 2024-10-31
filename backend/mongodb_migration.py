from pymongo import MongoClient
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# MongoDB connection URL
mongodb_url: str = os.getenv("MONGODB_URL")
mongodb_db_name: str = os.getenv("MONGODB_DB_NAME")

# Connect to MongoDB
client = MongoClient(mongodb_url)
db = client[mongodb_db_name]

# Access the auctions collection
auctions_collection = db["auctions"]

# Migration: Add 'predicted_score' to existing documents
result = auctions_collection.update_many(
    { "predicted_score": { "$exists": False } },  # Filter for documents without the field
    { "$set": { "predicted_score": 0 } }  # Set default value
)

print(f"Updated {result.modified_count} documents.")

# Close the connection
client.close()
