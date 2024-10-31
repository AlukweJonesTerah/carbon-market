from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import asyncio

load_dotenv()

class Settings:
    mongodb_url: str = os.getenv("MONGODB_URL")
    mongodb_db_name: str = os.getenv("MONGODB_DB_NAME")

settings = Settings()

# Check if we're in an async context by attempting to get an active event loop
def get_mongo_client():
    try:
        # Check for the presence of an active event loop
        asyncio.get_running_loop()
        print("Using AsyncIOMotorClient (asynchronous mode).")
        return AsyncIOMotorClient(settings.mongodb_url)  # Async Mongo client
    except RuntimeError:
        print("Using MongoClient (synchronous mode).")
        return MongoClient(settings.mongodb_url)  # Sync Mongo client

# Initialize the MongoDB client based on the environment
client = get_mongo_client()

# Set up collections
database = client[settings.mongodb_db_name]
user_coordinates_collection = database.get_collection("user_coordinates")
auctions_collection = database.get_collection("auctions")
bids_collection = database.get_collection("bids")
users_collection = database.get_collection("usercreater")
ckes_requests_collection = database.get_collection("ckes_requests")
admin_approvals_collection = database.get_collection("admin_approvals")
