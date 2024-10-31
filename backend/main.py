from fastapi import FastAPI, HTTPException, Depends, Query, status,  APIRouter, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, validator, Field, PositiveFloat
from typing import List, Optional
import os
import json
import httpx
import requests
import numpy as np
from uuid import uuid4
import cv2
from tensorflow.lite.python.interpreter import Interpreter
from ipfshttpclient import Client
import ipfshttpclient  # IPFS client
from dotenv import load_dotenv
from datetime import datetime, date
from database import auctions_collection, bids_collection, users_collection, ckes_requests_collection, user_coordinates_collection
from bson import ObjectId
from authentication import get_password_hash, pwd_context ,verify_password, create_access_token, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from models import UserCreate, LoginData, CKESRequest, AdminApproval, TokenData, RecovoryData
from jose import JWTError, jwt
from datetime import timedelta, datetime
from pymongo.errors import DuplicateKeyError
import asyncio
import base64
import subprocess
from mnemonic import Mnemonic
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.fernet import Fernet, InvalidToken
import traceback
from web3 import Web3
# from celo_sdk.kit import Kit




load_dotenv()

app = FastAPI()

router = APIRouter(prefix="/users")

# app.include_router(users_router)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Load the TFLite model
interpreter = Interpreter(model_path='./model/model.tflite')
interpreter.allocate_tensors()

# Google Maps API key
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# IPFS client
client = Client("/dns/ipfs.infura.io/tcp/5001/https")

# Pydantic model for the coordinates
class CoordinatesRequest(BaseModel):
    coordinates: List[str]

# Pydantic model for auction data with additional validation
class AuctionData(BaseModel):
    title: str
    description: str
    start_date: date   # Automatically convert strings to date objects
    end_date: date       # Automatically convert strings to date objects
    map_url: str
    coordinates: List[str]
    predicted_score: float = Field(..., description="Predicted carbon credits (in tons of CO2 equivalent).")
    carbon_credit_amount: PositiveFloat = Field(..., gt=0, description="Amount of carbon credits should be greater than 0")

    # Validator to check that start_date is not in the past
    @validator("start_date")
    def validate_start_date(cls, v):
        current_date = datetime.now().date()
        if v < current_date:
            raise ValueError("Start date cannot be before the current date.")
        return v

    # Validator to check that end_date is after start_date
    @validator("end_date")
    def validate_end_date(cls, v, values):
        if "start_date" in values and v <= values["start_date"]:
            raise ValueError("End date must be later than the start date.")
        return v
    
# Pydantic model for bid data
class BidData(BaseModel):
    auction_id: str
    bidder: str
    bid_amount: float = Field(..., gt=0, description="Bid amount should be greater than 0")

# Generate Celo account using Celo SDK
async def create_celo_account():
    # Use Celo contractkit to generate a mnemonic and account
    cmd = ['node', 'generateCeloAccount.js']  # Call a Node.js script to generate Celo account
    result = subprocess.run(cmd, capture_output=True, text=True)
    
     # Check if there was an error in execution
    if result.returncode != 0:
        print("Error executing Node.js script:", result.stderr)
        raise Exception("Failed to create Celo account")

    # Verify JSON output
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print("Invalid JSON output:", result.stdout)
        raise Exception("Node script did not return valid JSON") 

# Encrypt mnemonic using password
def encrypt_mnemonic(mnemonic: str, password: str) -> str:
    salt = os.urandom(16)
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
        backend=default_backend()
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    cipher_suite = Fernet(key)
    encrypted_mnemonic = cipher_suite.encrypt(mnemonic.encode())
    return base64.urlsafe_b64encode(salt + encrypted_mnemonic).decode()

# Decrypt mnemonic using password
def decrypt_mnemonic(encrypted_mnemonic: str, password: str) -> str:
    encrypted_data = base64.urlsafe_b64decode(encrypted_mnemonic)
    salt = encrypted_data[:16]
    encrypted_mnemonic = encrypted_data[16:]

    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100_000,
        backend=default_backend()
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    cipher_suite = Fernet(key)
    decrypted_mnemonic = cipher_suite.decrypt(encrypted_mnemonic).decode()
    return decrypted_mnemonic



def check_and_auto_fund(celo_address: str):
    try:
        # Run the autofundAccount.js script synchronously
        result = subprocess.run(
            ["node", "autoFundAccounts.js", celo_address],
            capture_output=True,
            text=True
        )
        
        # Log stdout and stderr for debugging purposes
        print(f"autofundAccount.js stdout: {result.stdout.strip()}")
        print(f"autofundAccount.js stderr: {result.stderr.strip()}")

        # Check if the script exited with an error
        if result.returncode != 0:
            print(f"autofundAccount.js exited with return code {result.returncode}")
            print(f"Error in autofund script stderr: {result.stderr.strip()}")
            return False

        # Ensure stdout has content
        if not result.stdout:
            print("Error: autofundAccount.js returned empty output.")
            return False

        # Attempt to parse JSON from stdout
        try:
            fund_result = json.loads(result.stdout.strip())
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON from autofundAccount.js: {e}")
            return False

        # Check fund_result to determine if funding was successful
        if fund_result.get("status") == "funded":
            print(f"User account {celo_address} funded successfully.")
            return True
        elif fund_result.get("status") == "low_funds":
            print("Funding account is low. Admin notification triggered.")
            return False
        elif fund_result.get("status") == "error":
            print(f"Error from autofundAccount.js: {fund_result.get('error')}")
            return False
        else:
            print("Funding not required.")
            return True

    except Exception as e:
        print(f"Error in check_and_auto_fund: {repr(e)}")
        return False



# Registration endpoint: creates Celo account and stores encrypted mnemonic
@app.post("/register/")
async def register(user: UserCreate):
    try:
        print("Received registration data:", user.dict())

        # Check if user already exists
        existing_user = await users_collection.find_one({"email": user.email})
        print("Existing user found:", existing_user)

        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists")

        # Generate Celo account and mnemonic
        celo_account = await create_celo_account()
        print("Celo account created:", celo_account)

        if not celo_account:
            raise HTTPException(status_code=500, detail="Failed to create Celo account")

        celo_address = celo_account["address"]
        mnemonic = celo_account["mnemonic"]

        if not celo_address or not mnemonic:
            raise HTTPException(status_code=500, detail="Incomplete account details from Celo account creation")

        # Encrypt mnemonic with user's password
        encrypted_mnemonic = encrypt_mnemonic(mnemonic, user.password)
        print("Encrypted mnemonic:", encrypted_mnemonic)

        # Store user details in database
        user_data = {
            "username": user.username,
            "email": user.email,
            "hashed_password": get_password_hash(user.password),
            "celoAddress": celo_address,
            "encryptedMnemonic": encrypted_mnemonic
        }

        # Insert the user into the database asynchronously
        result = await users_collection.insert_one(user_data)
        print("User registered with ID:", result.inserted_id)
        
        return {"message": "User registered successfully", "celoAddress": celo_address}

    except Exception as e:
        print(f"Error during registration: {e}")
        traceback.print_exc()  # Print the full traceback
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

# Login endpoint: authenticate user and decrypt mnemonic
@app.post("/login/")
async def login(user: LoginData):
    try:
        # Check if user exists
        existing_user = await users_collection.find_one({"username": user.username})
        if not existing_user:
            raise HTTPException(status_code=400, detail="Incorrect username or password")

        # Verify password
        if not verify_password(user.password, existing_user["hashed_password"]):
            raise HTTPException(status_code=400, detail="Incorrect username or password")

        # Call check_and_auto_fund without await, as it's now synchronous
        funded = check_and_auto_fund(existing_user["celoAddress"])

        # Generate token
        access_token = create_access_token({
            "sub": user.username, 
            "user_id": str(existing_user["_id"]), 
            "celoAddress": existing_user["celoAddress"]})
        
        return {
            "message": "Login successful",
            "celoAddress": existing_user["celoAddress"],
            "access_token": access_token,
            "funded": funded
        }

    except Exception as e:
        print(f"Error during login: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

    
def notify_admin(message: str):
    # Placeholder for sending notifications (e.g., email or alert)
    print("Admin Notification:", message)
    # integrate with email or messaging APIs to send notifications



# Backup recovery: recover account using mnemonic
@app.post("/recover/")
async def recover(user: LoginData):
    try:
        # Retrieve user data from the database
        existing_user = await users_collection.find_one({"username": user.username})

        if not existing_user:
            raise HTTPException(status_code=400, detail="User not found")

        # Decrypt the mnemonic
        decrypted_mnemonic = decrypt_mnemonic(existing_user["encryptedMnemonic"], user.password)

        # Return decrypted mnemonic
        return {
            "message": "Account recovery successful",
            "mnemonic": decrypted_mnemonic
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recovery error: {e}")

# View current user profile (returns public Celo address)
@app.get("/profile/{username}")
async def get_profile(username: str):
    try:
        user = await users_collection.find_one({"username": username})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "username": user["username"],
            "celoAddress": user["celoAddress"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error retrieving profile")


# Get current user based on JWT token
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized access",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        user_id = payload.get("user_id")
        celo_address = payload.get("celoAddress")
        if username is None or user_id is None or celo_address is None:
            print("Token missing username, user_id, or celoAddress")
            raise credentials_exception
    except JWTError as e:
        print(f"Token decoding error: {str(e)}")
        raise credentials_exception
    
    # Fetch user from DB and properly await the result
    user = await users_collection.find_one({
        "_id": ObjectId(user_id),
        "username": username,
        "celoAddress": celo_address
    })
    if user is None:
        print("User not found in database")
        raise credentials_exception
    return user

@app.get("/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {
        "_id": str(current_user["_id"]),
        "username": current_user["username"],
        "email": current_user["email"],
        "celoAddress": current_user["celoAddress"],
    }


@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    return {
        "_id": str(current_user["_id"]),
        "username": current_user["username"],
        "email": current_user["email"],
        "celoAddress": current_user["celoAddress"],
    }

# Mocked user data (replace with real database calls)
mock_users_db = {
    "admin_user": {"username": "admin_user", "role": "admin"},
    "regular_user": {"username": "regular_user", "role": "user"}
}

def get_user_from_db(username: str):
    # Mock function to get user details, replace with a real database call
    return mock_users_db.get(username)

async def get_current_admin_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
        token_data = TokenData(username=username, role=role)
    except JWTError:
        raise credentials_exception

    # Retrieve user and check if they are an admin
    user = get_user_from_db(token_data.username)
    if user is None or user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user

# Endpoint for users to request CKES
@router.post("/request_ckes")
async def request_ckes(request: CKESRequest, current_user: dict = Depends(get_current_user)):
    try:

         # Validate the requested amount
        if request.requested_amount <= 0:
            raise HTTPException(status_code=400, detail="Requested amount must be positive")

        request_data = request.dict()
        request_data.update({
            "user_id": str(current_user["_id"]),
            "username": current_user["username"],
            "celoAddress": current_user["celoAddress"],
            "status": "pending",
            "timestamp": datetime.utcnow()
        })

        result = await ckes_requests_collection.insert_one(request_data)
        return {"message": "CKES request submitted successfully", "request_id": str(result.inserted_id)}
    except Exception as e:
        print(f"Error submitting CKES request: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

# Endpoint for admin to view all pending CKES requests
@router.get("/admin/ckes_requests")
async def get_ckes_requests(admin_user: dict = Depends(get_current_admin_user)):
    try:
        requests = await ckes_requests_collection.find({"status": "pending"}).to_list(length=100)
        for req in requests:
            req["_id"] = str(req["_id"])
        return requests
    except Exception as e:
        print(f"Error fetching CKES requests: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    

PAYMENT_GATEWAY_API_URL = os.getenv("PAYMENT_GATEWAY_API_URL")
PAYMENT_GATEWAY_SECRET_KEY = os.getenv("PAYMENT_GATEWAY_SECRET_KEY")

async def verify_payment(request):
    try:
        # Transaction ID or reference from the user's payment
        transaction_id = request.get("transaction_id")
        required_amount = request.get("payment_amount")

        if not transaction_id:
            raise ValueError("Transaction ID is missing in the payment request")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{PAYMENT_GATEWAY_API_URL}/transactions/{transaction_id}",
                headers={"Authorization": f"Bearer {PAYMENT_GATEWAY_SECRET_KEY}"}
            )

        # Check if the response from the payment gateway is successful
        if response.status_code != 200:
            print(f"Payment verification failed: {response.text}")
            raise HTTPException(status_code=500, detail="Payment verification failed")

        # Parse the response
        payment_info = response.json()

        # Verify if the payment is successful and meets the required amount
        if payment_info["status"] == "successful" and float(payment_info["amount"]) >= required_amount:
            print("Payment verified successfully")
            return True
        else:
            print("Payment verification failed or amount mismatch")
            return False

    except Exception as e:
        print(f"Error in payment verification: {e}")
        return False

# Endpoint for admin to approve or reject CKES requests
@router.post("/admin/ckes_requests/approve")
async def approve_ckes_request(approval: AdminApproval, admin_user: dict = Depends(get_current_admin_user)):
    try:
        request_id = approval.request_id
        approved = approval.approved
        admin_notes = approval.admin_notes

        # Fetch the CKES request
        request = await ckes_requests_collection.find_one({"_id": ObjectId(request_id)})
        if not request:
            raise HTTPException(status_code=404, detail="CKES request not found")

        if request["status"] != "pending":
            raise HTTPException(status_code=400, detail="CKES request is not pending")

        # Verify payment before approval
        if approved and not verify_payment(request):
            raise HTTPException(status_code=400, detail="Payment not verified")
        
        # Update the request status
        new_status = "approved" if approved else "rejected"
        await ckes_requests_collection.update_one(
            {"_id": ObjectId(request_id)},
            {"$set": {"status": new_status, "admin_notes": admin_notes}}
        )

        if approved:
            # Proceed to transfer CKES
            transfer_result = transfer_ckes_to_user(request)
            if not transfer_result["success"]:
                raise HTTPException(status_code=500, detail=f"Failed to transfer CKES: {transfer_result['error']}")
            return {"message": "CKES request approved and CKES transferred successfully"}
        else:
            return {"message": "CKES request rejected"}

    except Exception as e:
        print(f"Error in approving CKES request: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def transfer_ckes_to_user(request):
    try:
        recipient_address = request["celoAddress"]
        requested_amount = request["requested_amount"]

        # Convert CKES amount to wei (1 CKES = 1e18 wei)
        wei_amount = int(requested_amount * 1e18)

        # Call the Node.js script
        # result = subprocess.run(
        #     ["node", "transferCkes.js", recipient_address, str(wei_amount)],
        #     capture_output=True,
        #     text=True
        # )

        process = await asyncio.create_subprocess_exec(
            "node", "transferCkes.js", recipient_address, str(wei_amount),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            return {"success": False, "error": stderr.decode()}
        

        # Parse the output
        output = json.loads(stdout.decode())
        if output.get("status") == "success":
            return {"success": True}
        else:
            return {"success": False, "error": output.get("error")}

    except Exception as e:
        print(f"Error in transfer_ckes_to_user: {e}")
        return {"success": False, "error": str(e)}


# Endpoint for processing coordinates

@app.post("/process_coordinates/")
async def process_coordinates(request: CoordinatesRequest, current_user: dict = Depends(get_current_user)):
    # Ensure authorization with current_user
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized access")

    try:
        joined_coordinates = "|".join(request.coordinates)
        map_url = (
            f"https://maps.googleapis.com/maps/api/staticmap?size=400x400&maptype=satellite&"
            f"path=color:0xff0000ff|weight:5|{joined_coordinates}&key={GOOGLE_MAPS_API_KEY}"
        )

        # Fetch map and check response
        async with httpx.AsyncClient() as client:
            response = await client.get(map_url)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Error fetching map image")

        # Process the map image and predict the score
        nparr = np.frombuffer(response.content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        img = cv2.resize(img, (256, 256)) / 255.0
        img = np.expand_dims(img, axis=0).astype(np.float32)

        input_index = interpreter.get_input_details()[0]['index']
        interpreter.set_tensor(input_index, img)
        interpreter.invoke()

        output_index = interpreter.get_output_details()[0]['index']
        predicted_score = round(float(interpreter.get_tensor(output_index)[0][0]), 1)

        # Store processed data
        coordinates_data = {
            "user_id": str(current_user["_id"]),
            "coordinates": request.coordinates,
            "map_url": map_url,
            "predicted_score": predicted_score,
            "processed_at": datetime.utcnow().isoformat()
        }
        await user_coordinates_collection.replace_one({"user_id": str(current_user["_id"])}, coordinates_data, upsert=True)

        return {"predicted_score": predicted_score, "map_url": map_url, "message": "Coordinates processed successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process coordinates: {str(e)}")
    
import tempfile

# Pinata credentials from environment variables
PINATA_API_KEY = os.getenv("PINATA_API_KEY")
PINATA_API_SECRET = os.getenv("PINATA_API_SECRET")
WEB3_STORAGE_TOKEN = os.getenv("WEB3_STORAGE_TOKEN")

# Check environment variables
if not all([PINATA_API_KEY, PINATA_API_SECRET]):
    raise Exception("Pinata API credentials are missing. Please check environment variables.")

# Function to call JavaScript for Web3.Storage upload
# def upload_to_web3_storage(file_path):
    # try:
    #     # Call the JavaScript file to upload the file to Web3.Storage
    #     result = subprocess.run(
    #         ['node', 'web3StorageUpload.js', file_path],
    #         stdout=subprocess.PIPE,
    #         stderr=subprocess.PIPE,
    #         text=True
    #     )

        # Check if there was an error
        # if result.returncode != 0:
        #     print("Error uploading to Web3.Storage:", result.stderr)
        #     return None

        # Capture and return the IPFS URL from stdout
    #     ipfs_url = result.stdout.strip()
    #     print("File uploaded to Web3.Storage:", ipfs_url)
    #     return ipfs_url
    # except Exception as e:
    #     print(f"Failed to upload to Web3.Storage: {e}")
        # return None
    
# Function to upload to Pinata as a backup
def upload_to_pinata(file_path):
    """
    Upload to Pinata as a backup service
    """
    try:
        url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
        headers = {
            "pinata_api_key": PINATA_API_KEY,
            "pinata_secret_api_key": PINATA_API_SECRET
        }
        
        # Make sure we're reading the file in binary mode
        with open(file_path, "rb") as file:
            files = {"file": file}
            response = requests.post(url, headers=headers, files=files)
            response.raise_for_status()
            ipfs_hash = response.json()["IpfsHash"]
            return f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}"
    except Exception as e:
        print(f"Error uploading to Pinata: {e}")
        return None   
# Unified function with Web3.Storage and Pinata backup
def upload_file_with_backup(file_path):
    # Attempt upload to Web3.Storage
    ipfs_url = upload_to_pinata(file_path)
    if ipfs_url:
        return ipfs_url

    # Fallback to Pinata if Web3.Storage fails
    print("Web3.Storage upload failed. Trying Pinata...")
    return upload_to_pinata(file_path)

# Download an image from a URL for uploading to Web3.Storage/Pinata
def download_image_from_url(url):
    response = requests.get(url)
    if response.status_code == 200:
        return response.content  # Binary content of the image
    else:
        raise Exception(f"Failed to download image from {url}, status code {response.status_code}")

# Save and upload an image
def save_and_upload_image(image_content):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
        temp_file.write(image_content)
        temp_file_path = temp_file.name
    try:
        ipfs_url = upload_to_pinata(temp_file_path)
        if not ipfs_url:
            print("Web3.Storage upload failed. Trying Pinata...")
            ipfs_url = upload_to_pinata(temp_file_path)
        return ipfs_url
    finally:
        os.remove(temp_file_path)

# Save and upload JSON data
def save_and_upload_json(data):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as temp_file:
        json.dump(data, temp_file)
        temp_file_path = temp_file.name
    try:
        ipfs_url = upload_to_pinata(temp_file_path)
        if not ipfs_url:
            print("Web3.Storage upload failed. Trying Pinata...")
            ipfs_url = upload_to_pinata(temp_file_path)
        return ipfs_url
    finally:
        os.remove(temp_file_path)

# Endpoint for creating an auction
@app.post("/create_auction/")
async def create_auction(data: AuctionData, current_user: dict = Depends(get_current_user)):
    print("Received auction data:", data)
    print("Auction Data Received:", data.dict())
    print("Received coordinates:", data.coordinates)

    try:
        user_id = str(current_user["_id"])

        # Fetch user coordinates
        coordinates_record = await user_coordinates_collection.find_one({"user_id": user_id})
        if not coordinates_record:
            raise HTTPException(status_code=400, detail="Please complete the coordinates form before creating an auction.")

        # Prepare auction data
        auction_info = {
            "title": data.title,
            "description": data.description,
            "start_date": data.start_date.isoformat(),
            "end_date": data.end_date.isoformat(),
            "map_url": data.map_url,
            "coordinates": data.coordinates,
            "predicted_score": data.predicted_score,
            "carbon_credit_amount": data.carbon_credit_amount,
            "created_at": datetime.now().isoformat(),
            "creator_id": user_id,
            "creator_address": current_user["celoAddress"],
        }

        # Upload to IPFS
        try:
            ipfs_hash = ipfs_client.add_json(auction_info)
            print("IPFS hash:", ipfs_hash)
            if not ipfs_hash:
                raise HTTPException(status_code=500, detail="Invalid response from IPFS.")
        except Exception as ipfs_error:
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"IPFS upload failed: {str(ipfs_error)}")

        # Save auction in database
        auction_info["ipfs_hash"] = ipfs_hash  # Optionally store the IPFS hash in the auction info
        result = await auctions_collection.insert_one(auction_info)
        auction_info["_id"] = str(result.inserted_id)

        return {
            "message": "Auction created successfully",
            "auction_id": auction_info["_id"],
            "ipfs_hash": ipfs_hash,
            "auction_info": auction_info,
        }

    except Exception as e:
        print(f"Error creating auction: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to create auction: {str(e)}")
    
# Endpoint to fetch all auctions with pagination
@app.get("/auctions/")
async def get_auctions(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    skip = (page - 1) * limit
    auctions = await auctions_collection.find().skip(skip).limit(limit).to_list(length=limit)

    # Convert ObjectId to string for JSON serialization
    for auction in auctions:
        auction["_id"] = str(auction["_id"])

    return {"auctions": auctions, "page": page, "limit": limit}

async def check_user_balance(address: str, required_amount: float) -> bool:
    # Connect to the Celo testnet
    web3 = Web3(Web3.HTTPProvider("https://alfajores-forno.celo-testnet.org"))
    
    # Get the user's balance in wei and convert it to ether
    balance_wei = web3.eth.get_balance(address)
    balance_eth = web3.fromWei(balance_wei, 'ether')
    
    # Check if balance is sufficient
    return balance_eth >= required_amount

# Endpoint to place a bid
@app.post("/place_bid/") #, current_user: dict = Depends(get_current_user)
async def place_bid(bid: BidData, current_user: dict = Depends(get_current_user)):
    try:
        # Find the auction by ID
        auction = await auctions_collection.find_one({"_id": ObjectId(bid.auction_id)})
        if not auction:
            raise HTTPException(status_code=404, detail="Auction not found")

        # Prevent users from bidding on their own auctions
        if auction["creator_id"] == str(current_user["_id"]):
            raise HTTPException(status_code=400, detail="You cannot bid on your own auction")
        
        # Check if the auction has already ended
        end_date = datetime.fromisoformat(auction['end_date'])
        if datetime.now() > end_date:
            raise HTTPException(status_code=400, detail="The auction has already ended")

        # Check user CKES balance before placing a bid
        required_balance = bid.bid_amount  # Adjust as needed based on your logic
        if not await check_user_balance(current_user["celo_address"], required_balance):
            raise HTTPException(status_code=400, detail="Insufficient CKES balance to place bid")

        # Add the bid to the bids collection
        bid_data = {
            "auction_id": bid.auction_id,
            "bidder_id": str(current_user["_id"]),
            "bidder_address": current_user["celo_address"],
            "bid_amount": bid.bid_amount,
            "bid_time": datetime.now().isoformat(),
        }
        await bids_collection.insert_one(bid_data)

        return {"message": "Bid placed successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to place bid: {str(e)}")

# Endpoint to fetch the highest bid for an auction
@app.get("/highest_bid/{auction_id}")
async def get_highest_bid(auction_id: str):
    try:
        # Find the highest bid by auction_id
        highest_bid = await bids_collection.find_one(
            {"auction_id": auction_id},
            sort=[("bid_amount", -1)]  # Sort by bid amount in descending order
        )

        if not highest_bid:
            return {"message": "No bids found for this auction"}

        # Convert ObjectId to string before returning the response
        highest_bid["_id"] = str(highest_bid["_id"])
        highest_bid["auction_id"] = str(highest_bid["auction_id"])

        return {
            "highest_bid": highest_bid,
            "bidder_address": highest_bid["bidder_address"]  # Include bidder's Celo address
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve highest bid: {str(e)}")



def transfer_funds_and_carbon_credits(winner_address, owner_address, bid_amount, carbon_credit_amount):
    try:
        # Initialize web3 and kit
        web3 = Web3(Web3.HTTPProvider("https://alfajores-forno.celo-testnet.org"))
        kit = Kit(web3)

        # Load funding account
        FUNDING_ACCOUNT_PRIVATE_KEY = os.getenv("FUNDING_ACCOUNT_PRIVATE_KEY")
        if not FUNDING_ACCOUNT_PRIVATE_KEY:
            return {"success": False, "error": "Funding account private key not set"}

        funding_account = kit.w3.eth.account.from_key(FUNDING_ACCOUNT_PRIVATE_KEY)
        funding_address = funding_account.address

        # Check winner's balance
        winner_balance = kit.w3.eth.get_balance(winner_address)
        bid_amount_wei = kit.w3.toWei(bid_amount, 'ether')

        # Estimate gas fees
        gas_price = kit.w3.eth.gas_price
        gas_limit = 21000  # Standard gas limit for transfers
        total_gas_fee = gas_price * gas_limit

        # Total amount needed (bid amount + gas fee)
        total_amount_needed = bid_amount_wei + total_gas_fee

        # Check if winner has enough balance
        if winner_balance < total_amount_needed:
            # Use funding account to cover gas fee
            print("Winner has insufficient balance. Using funding account for gas fees.")
            # Transfer bid amount from winner to owner
            tx = {
                'nonce': kit.w3.eth.get_transaction_count(winner_address),
                'to': owner_address,
                'value': bid_amount_wei,
                'gas': gas_limit,
                'gasPrice': gas_price,
            }

            signed_tx = kit.w3.eth.account.sign_transaction(tx, private_key=FUNDING_ACCOUNT_PRIVATE_KEY)
            tx_hash = kit.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = kit.w3.eth.wait_for_transaction_receipt(tx_hash)
        else:
            # Winner pays for gas fees
            print("Winner has sufficient balance. Proceeding with transaction.")
            tx = {
                'nonce': kit.w3.eth.get_transaction_count(winner_address),
                'to': owner_address,
                'value': bid_amount_wei,
                'gas': gas_limit,
                'gasPrice': gas_price,
            }

            # Assuming you have the winner's private key (this may not be the case)
            # In practice, you'd need the winner to sign the transaction client-side
            # For this example, we'll simulate it using the funding account
            signed_tx = kit.w3.eth.account.sign_transaction(tx, private_key=FUNDING_ACCOUNT_PRIVATE_KEY)
            tx_hash = kit.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
            receipt = kit.w3.eth.wait_for_transaction_receipt(tx_hash)

        # Transfer carbon credits from owner to winner
        # Assuming carbon credits are ERC20 tokens with a smart contract address
        carbon_credit_contract_address = os.getenv("CARBON_CREDIT_CONTRACT_ADDRESS")
        if not carbon_credit_contract_address:
            return {"success": False, "error": "Carbon credit contract address not set"}

        # Load the contract
        abi = [...]  # ABI of the carbon credit token contract
        contract = kit.w3.eth.contract(address=carbon_credit_contract_address, abi=abi)

        # Prepare token transfer transaction
        transfer_function = contract.functions.transfer(
            winner_address,
            kit.w3.toWei(carbon_credit_amount, 'ether')
        )

        tx = transfer_function.buildTransaction({
            'from': owner_address,
            'nonce': kit.w3.eth.get_transaction_count(owner_address),
            'gas': 100000,  # Adjust gas limit as needed
            'gasPrice': gas_price,
        })

        # Sign the transaction with the owner's private key
        owner_private_key = get_owner_private_key(owner_address)
        signed_tx = kit.w3.eth.account.sign_transaction(tx, private_key=owner_private_key)
        tx_hash = kit.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = kit.w3.eth.wait_for_transaction_receipt(tx_hash)

        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

async def finalize_auction(auction):
    try:
        auction_id = auction["_id"]
        auction_owner_address = auction["creator_address"]
        carbon_credit_amount = auction["carbon_credit_amount"]

        # Find the highest bid
        highest_bid = await bids_collection.find_one(
            {"auction_id": str(auction_id)},
            sort=[("bid_amount", -1)]
        )

        if not highest_bid:
            # No bids were placed; update auction status
            await auctions_collection.update_one(
                {"_id": auction_id},
                {"$set": {"status": "no_bids"}}
            )
            print(f"Auction {auction_id} ended with no bids.")
            return

        winner_id = highest_bid["bidder_id"]
        winner_address = highest_bid["bidder_address"]
        bid_amount = highest_bid["bid_amount"]

        # Transfer funds and carbon credits
        payment_result = transfer_funds_and_carbon_credits(
            winner_address,
            auction_owner_address,
            bid_amount,
            carbon_credit_amount
        )

        if payment_result["success"]:
            # Update auction status to finalized
            await auctions_collection.update_one(
                {"_id": auction_id},
                {"$set": {"status": "finalized", "winner_id": winner_id}}
            )
            print(f"Auction {auction_id} finalized successfully.")
        else:
            print(f"Failed to finalize auction {auction_id}: {payment_result['error']}")
            # Optionally, handle failure (e.g., notify admin)
    except Exception as e:
        print(f"Error finalizing auction {auction_id}: {e}")

async def check_and_finalize_auctions():
    try:
        current_time = datetime.utcnow()
        # Find auctions that have ended and are not yet finalized
        ended_auctions = await auctions_collection.find({
            "end_date": {"$lte": current_time.isoformat()},
            "status": {"$ne": "finalized"}
        }).to_list(length=100)

        for auction in ended_auctions:
            auction_id = auction["_id"]
            print(f"Finalizing auction {auction_id}")
            await finalize_auction(auction)
    except Exception as e:
        print(f"Error in auction finalizer: {e}")

async def auction_finalizer():
    while True:
        await check_and_finalize_auctions()
        await asyncio.sleep(60)  # Wait for 60 seconds before checking again

@app.on_event("startup")
async def start_auction_finalizer():
    asyncio.create_task(auction_finalizer())

# Main entry point for FastAPI
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
