from fastapi import FastAPI, HTTPException, Depends, Query, status,  APIRouter, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, ValidationError, validator, Field, PositiveFloat, field_validator
from jwt import ExpiredSignatureError, InvalidTokenError
from typing import List, Optional, Union
from pathlib import Path
import os
import json
import httpx
import shutil
import logging
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
from models import UserCreate, LoginData, CKESRequest, AdminApproval, TokenData, RecovoryData, KYCDetails
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
from decimal import Decimal
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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Google Maps API key
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# IPFS client
client = Client("/dns/ipfs.infura.io/tcp/5001/https")

# Pydantic model for the coordinates
class CoordinatesRequest(BaseModel):
    coordinates: List[str]


from pydantic import BaseModel, Field, validator, model_validator
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP, DecimalException

class AuctionData(BaseModel):
    title: str
    description: str
    start_date: date = Field(default_factory=datetime.now().date)
    end_date: date
    map_url: str
    coordinates: List[str]
    predicted_score: float = Field(..., gt=0, description="Predicted carbon credits in tons.")
    total_carbon_tonnage: float = Field(..., gt=0, description="Total carbon tonnage for the project.")
    carbon_credit_amount: Optional[Decimal] = 0  # Calculated on the backend

    # Constants (prefixed with underscore to indicate they are not fields)
    _COST_PER_TON_KES: Decimal = Decimal("0.5")  # Conversion rate for 1 ton in KSH
    _BUFFER_PERCENTAGE: Decimal = Decimal("1.3")   # 130% maximum buffer

    # Calculated fields (not required in user input)
    estimated_cost_per_ton: Optional[Decimal] = 0
    total_estimated_cost: Optional[Decimal] = 0
    min_carbon_credit: Optional[Decimal] = 0
    max_carbon_credit: Optional[Decimal] = 0

    @validator("start_date")
    def validate_start_date(cls, v):
        current_date = datetime.now().date()
        if v < current_date:
            return current_date
        return v

    @validator("end_date")
    def validate_end_date(cls, v, values):
        if "start_date" in values and v <= values["start_date"]:
            raise ValueError("End date must be later than the start date.")
        return v

    @validator("predicted_score", pre=True)
    def validate_predicted_score(cls, v):
        if not isinstance(v, (int, float, Decimal)) or float(v) <= 0:
            raise ValueError("Predicted score must be a positive number greater than 0")
        return float(v)
    
    @model_validator(mode='after')
    def calculate_estimated_cost_and_credit_range(self):
        try:
            predicted_score = Decimal(str(self.predicted_score))
            total_carbon_tonnage = Decimal(str(self.total_carbon_tonnage))
            cost_per_ton_kes = self._COST_PER_TON_KES
            buffer_percentage = self._BUFFER_PERCENTAGE

            # Calculate Estimated Cost per Ton
            estimated_cost_per_ton = (predicted_score * cost_per_ton_kes).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            
            # Calculate Total Estimated Cost
            total_estimated_cost = (estimated_cost_per_ton * total_carbon_tonnage).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            
            # Calculate Min and Max Carbon Credit
            min_carbon_credit = total_estimated_cost
            max_carbon_credit = (total_estimated_cost * buffer_percentage).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            # Calculate a default carbon credit amount within the range (e.g., 110%)
            carbon_credit_amount = (total_estimated_cost * Decimal("1.1")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            
            # Ensure the calculated amount is within the defined range
            if carbon_credit_amount < min_carbon_credit:
                carbon_credit_amount = min_carbon_credit
            elif carbon_credit_amount > max_carbon_credit:
                carbon_credit_amount = max_carbon_credit
            
            # Assign calculated values to model fields
            self.estimated_cost_per_ton = estimated_cost_per_ton
            self.total_estimated_cost = total_estimated_cost
            self.min_carbon_credit = min_carbon_credit
            self.max_carbon_credit = max_carbon_credit
            self.carbon_credit_amount = carbon_credit_amount

            return self
        except (TypeError, ValueError, DecimalException) as e:
            raise ValueError(f"Error in calculations: {str(e)}") from e

    class Config:
        json_encoders = {
            Decimal: lambda v: f"{float(v):.2f}"  # Format decimals for JSON response
        }

class CalculationExplanationRequest(BaseModel):
    predicted_score: Decimal = Field(..., gt=0, description="Predicted carbon credits (in tons of CO2 equivalent).")
    total_carbon_tonnage: Decimal = Field(..., gt=0, description="Total estimated carbon tonnage of the property.")


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



import subprocess
import json
def check_and_auto_fund(celo_address: str):
    try:
        # Run the autofundAccount.js script synchronously
        result = subprocess.run(
            ["node", "autoFundAccounts.js", celo_address],
            capture_output=True,
            text=True
        )
        
        # Log stdout and stderr for debugging purposes
        print(f"autofundAccounts.js stdout: {result.stdout.strip()}")
        print(f"autofundAccounts.js stderr: {result.stderr.strip()}")

        # Check if the script exited with an error
        if result.returncode != 0:
            print(f"autofundAccount.js exited with return code {result.returncode}")
            print(f"Error in autofund script stderr: {result.stderr.strip()}")
            return False

        # Ensure stdout has content
        if not result.stdout:
            print("Error: autofundAccount.js returned empty output.")
            return False

        # Split stdout by lines and get the last line
        output_lines = result.stdout.strip().splitlines()
        last_line = output_lines[-1]

        # Attempt to parse JSON from the last line of stdout
        try:
            fund_result = json.loads(last_line)
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

# Helper function to run autofund and get balance info
def check_and_get_balance(celo_address: str):
    try:
        # Execute autofundAccount.js synchronously to get balance
        result = subprocess.run(
            ["node", "autoFundAccounts.js", celo_address],
            capture_output=True,
            text=True
        )

        # Log stdout for debugging
        print(f"autofundAccount.js stdout: {result.stdout.strip()}")
        print(f"autofundAccounts.js stderr: {result.stderr.strip()}")
        
        # Split stdout by lines and attempt to parse only the last line
        output_lines = result.stdout.strip().splitlines()
        last_line = output_lines[-1]

        # Parse the last line as JSON
        fund_result = json.loads(last_line)
        if "balance" in fund_result:
            # Return balance and status
            return {"balance": fund_result["balance"], "status": fund_result["status"]}
        else:
            print("Error: Balance info missing in autofund script output")
        return None

    except Exception as e:
        print(f"Error in check_and_get_balance: {e}")
        return None

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
        logger.error("Error during registration: %s", e)
        logger.debug("Traceback: %s", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal server error: {e}")

KYC_UPLOAD_PATH = Path("./kyc_uploads")
KYC_UPLOAD_PATH.mkdir(parents=True, exist_ok=True)

# KYC endpoint: creates Celo account and stores encrypted mnemonic
@app.post("/submit-kyc/")
async def submit_kyc(
    kyc: KYCDetails
):
    try:
        # Log incoming data for debugging
        print(f"Received KYC data for user_id={kyc.user_id}, full_name={kyc.full_name}")
        
        # Save files or process them as needed
        front_id_path = f"uploads/{kyc.front_id_card.filename}"
        back_id_path = f"uploads/{kyc.back_id_card.filename}"
        
        with open(front_id_path, "wb") as f:
            f.write(await kyc.front_id_card.read())
        with open(back_id_path, "wb") as f:
            f.write(await kyc.back_id_card.read())
        
        # Simulate database update
        kyc_data = {
            "user_id": kyc.user_id,
            "full_name": kyc.full_name,
            "date_of_birth": kyc.date_of_birth,
            "address": kyc.address,
            "id_number": kyc.id_number,
            "front_id_card": front_id_path,
            "back_id_card": back_id_path,
        }
        print("KYC Details stored:", kyc_data)
        
        return {"message": "KYC details submitted successfully", "kyc_data": kyc_data}
    
    except Exception as e:
        print(f"Error during KYC submission: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to submit KYC details")
    
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

        # Call check_and_auto_fund synchronously and check if funding was successful
        funded = check_and_auto_fund(existing_user["celoAddress"])

        # If funding failed, deny login and return an error message
        if not funded:
            raise HTTPException(status_code=400, detail="Failed to fund the account. Login denied.")

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
    
# Get current user based on JWT token
async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized access",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        username = payload.get("sub")
        celo_address = payload.get("celoAddress")
        if not all([user_id, username, celo_address]):
            raise credentials_exception

        user = await users_collection.find_one({
            "_id": ObjectId(user_id),
            "username": username,
            "celoAddress": celo_address
        })
        if user is None:
            raise credentials_exception
        return user

    except ExpiredSignatureError:
        logger.error("Token has expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except InvalidTokenError:
        logger.error("Invalid token")
        raise credentials_exception
    except Exception as e:
        logger.error("Error retrieving current user: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

@app.post("/token")
async def generate_token(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        # Retrieve user from database based on username
        existing_user = await users_collection.find_one({"username": form_data.username})
        if not existing_user or not verify_password(form_data.password, existing_user["hashed_password"]):
            raise HTTPException(status_code=400, detail="Incorrect username or password")
        
        # Generate access token
        access_token = create_access_token({
            "sub": form_data.username, 
            "user_id": str(existing_user["_id"]), 
            "celoAddress": existing_user["celoAddress"]
        })

        # Return the token in the response
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }

    except Exception as e:
        print(f"Error during token generation: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Token generation error")
      
# Example token blacklist to store invalidated tokens
invalidated_tokens = set()

# Logout endpoint
@app.post("/logout/")
async def logout(token: str = Depends(oauth2_scheme)):
    """
    Logs the user out by blacklisting the current token.
    """
    try:
        # Decode the token to ensure it's valid
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # Add the token to the blacklist
        invalidated_tokens.add(token)
        
        return {"message": "Logged out successfully"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
@app.post("/refresh_token/")
async def refresh_token(current_user: dict = Depends(get_current_user)):
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Unauthorized")

        # Generate a new token
        new_token = create_access_token(data={"sub": current_user["_id"]})
        return {"access_token": new_token, "token_type": "bearer"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to refresh token")

def notify_admin(message: str):
    # Placeholder for sending notifications (e.g., email or alert)
    print("Admin Notification:", message)
    # integrate with email or messaging APIs to send notifications


# Backup recovery: recover account using mnemonic
@app.post("/recover/")
async def recover_account(user: LoginData):
    try:
        # Retrieve user data from the database
        existing_user = await users_collection.find_one({"username": user.username})

        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")

        # Decrypt the mnemonic
        decrypted_mnemonic = decrypt_mnemonic(existing_user["encryptedMnemonic"], user.password)

        # Return decrypted mnemonic
        return {
            "message": "Account recovery successful",
            "mnemonic": decrypted_mnemonic
        }
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Decryption error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred during recovery")

from decimal import Decimal

# Constants for conversion
CELO_TO_USD = Decimal("0.647801")
CELO_TO_KES = Decimal("78.75")

# View current user profile with Celo balance in CELO, USD, and KES
@app.get("/profile/")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    try:
        # Fetch Celo balance from autofundAccount script
        balance_info = check_and_get_balance(current_user["celoAddress"])

        if not balance_info:
            raise HTTPException(status_code=500, detail="Error retrieving Celo balance")

        # Convert balance from Wei to CELO
        balance_wei = int(balance_info["balance"])
        balance_celo = Decimal(balance_wei) / Decimal(1e18)

        # Convert CELO balance to USD and KES
        balance_usd = balance_celo * CELO_TO_USD
        balance_kes = balance_celo * CELO_TO_KES

        # Return user profile with balance details
        return {
            "username": current_user["username"],
            "email": current_user["email"],
            "celoAddress": current_user["celoAddress"],
            "celoBalance": f"{balance_celo:.18f}",  # Show full precision of CELO balance
            "fund_status": balance_info["status"],
            "balance_usd": f"${balance_usd:.2f}",
            "balance_kes": f"KES {balance_kes:.2f}"
        }

    except ValueError as e:
        print(f"Balance retrieval error: {e}")
        raise HTTPException(status_code=400, detail="Error in balance conversion")
    except Exception as e:
        print(f"Error retrieving profile: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred while retrieving the profile")


# Get minimal current user info (no need for two separate /me endpoints)
@app.get("/me")
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
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
    try:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized access"
            )

        joined_coordinates = "|".join(request.coordinates)
        map_url = (
            f"https://maps.googleapis.com/maps/api/staticmap?size=400x400&maptype=satellite&"
            f"path=color:0xff0000ff|weight:5|{joined_coordinates}&key={GOOGLE_MAPS_API_KEY}"
        )

        async with httpx.AsyncClient() as client:
            response = await client.get(map_url)

        if response.status_code != 200:
            raise HTTPException(
                status_code=400,
                detail="Error fetching map image from Google Maps API"
            )

        nparr = np.frombuffer(response.content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        img = cv2.resize(img, (256, 256)) / 255.0
        img = np.expand_dims(img, axis=0).astype(np.float32)

        input_index = interpreter.get_input_details()[0]["index"]
        interpreter.set_tensor(input_index, img)
        interpreter.invoke()

        output_index = interpreter.get_output_details()[0]["index"]
        predicted_score = round(float(interpreter.get_tensor(output_index)[0][0]), 1)

        coordinates_data = {
            "user_id": str(current_user["_id"]),
            "coordinates": request.coordinates,
            "map_url": map_url,
            "predicted_score": predicted_score,
            "processed_at": datetime.utcnow().isoformat(),
        }

        await user_coordinates_collection.replace_one(
            {"user_id": str(current_user["_id"])}, coordinates_data, upsert=True
        )

        return {
            "predicted_score": predicted_score,
            "map_url": map_url,
            "message": "Coordinates processed successfully",
        }
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has expired. Please log in again.",
        )
    except Exception as e:
        print(f"Error processing coordinates: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to process coordinates. Please try again."
        )
   
import tempfile
import aiohttp
import aiofiles

# Pinata credentials from environment variables
PINATA_API_KEY = os.getenv("PINATA_API_KEY")
PINATA_API_SECRET = os.getenv("PINATA_API_SECRET")
NFT_STORAGE_API_KEY = os.getenv("NFT_STORAGE_API_KEY")

# Check environment variables
if not all([PINATA_API_KEY, PINATA_API_SECRET, NFT_STORAGE_API_KEY]):
    raise Exception("Pinata  or NFT API credentials are missing. Please check environment variables.")

# Upload JSON data to NFT.Storage
async def upload_to_nft_storage(data):
    try:
        url = "https://api.nft.storage/upload"
        headers = {
            "Authorization": f"Bearer {NFT_STORAGE_API_KEY}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=data)
            response.raise_for_status()
            cid = response.json()["value"]["cid"]
            return f"https://{cid}.ipfs.dweb.link"
    except Exception as e:
        print(f"Error uploading to NFT.Storage: {e}")
        return None
      
# Function to upload to Pinata 
async def upload_to_pinata(file_path):
    """
    Upload to Pinata as the primary IPFS service.
    """
    try:
        url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
        headers = {
            "pinata_api_key": PINATA_API_KEY,
            "pinata_secret_api_key": PINATA_API_SECRET
        }

        # Upload the file using aiofiles
        async with aiofiles.open(file_path, 'rb') as f:
            file_content = await f.read()
            files = {'file': ('filename', file_content)}

            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, files=files)
                response.raise_for_status()
                ipfs_hash = response.json()["IpfsHash"]
                return f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}"
    except Exception as e:
        print(f"Error uploading to Pinata: {e}")
        return None
    
# Function to upload JSON or binary data to local IPFS gateway
async def upload_to_ipfs_gateway(data: Union[bytes, dict]):
    """Upload to IPFS HTTP Gateway with support for binary files."""
    try:
        url = "https://ipfs.infura.io:5001/api/v0/add"
        headers = {"Content-Type": "multipart/form-data"}

        async with httpx.AsyncClient() as client:
            if isinstance(data, bytes):
                files = {"file": ("data.bin", data)}
            else:
                files = {"file": ("data.json", json.dumps(data).encode("utf-8"))}

            response = await client.post(url, headers=headers, files=files)
            response.raise_for_status()
            ipfs_hash = response.json()["Hash"]
            return f"https://ipfs.io/ipfs/{ipfs_hash}"
    except Exception as e:
        print(f"Error uploading to IPFS Gateway: {e}")
        return None

# Primary upload function with backup options
import aiofiles
import json
from fastapi import HTTPException

# Primary upload function with backup options
async def upload_file_with_backup(file_path):
    # Attempt to upload to Pinata
    print("Attempting to upload to Pinata...")
    ipfs_url = await upload_to_pinata(file_path)
    if ipfs_url:
        return {"ipfs_url": ipfs_url, "source": "Pinata"}
    
    # Attempt NFT.Storage
    print("Pinata upload failed. Trying NFT.Storage...")
    async with aiofiles.open(file_path, 'r') as f:
        file_data = await f.read()
    try:
        json_data = json.loads(file_data)  # Try JSON for NFT.Storage
        ipfs_url = await upload_to_nft_storage(json_data)
        if ipfs_url:
            return {"ipfs_url": ipfs_url, "source": "NFT.Storage"}
    except json.JSONDecodeError:
        print("File is not valid JSON, skipping NFT.Storage.")

    # Final fallback: IPFS Gateway (binary-compatible)
    print("NFT.Storage upload failed. Trying IPFS Gateway...")
    try:
        async with aiofiles.open(file_path, 'rb') as f:
            file_data = await f.read()
        ipfs_url = await upload_to_ipfs_gateway(file_data)
        if ipfs_url:
            return {"ipfs_url": ipfs_url, "source": "IPFS Gateway"}
    except Exception as e:
        print("Error uploading to IPFS Gateway:", e)

    print("All IPFS upload attempts failed.")
    return None

# Download an image from a URL for uploading to Web3.Storage/Pinata
async def download_image_from_url(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            if response.status != 200:
                raise Exception(f"Failed to download image from {url}, status code {response.status}")
            return await response.read()

# Save and upload image content to IPFS
async def save_and_upload_image(image_content):
    async with aiofiles.tempfile.NamedTemporaryFile(delete=False, suffix=".png") as temp_file:
        await temp_file.write(image_content)
        temp_file_path = temp_file.name
    try:
        upload_result = await upload_file_with_backup(temp_file_path)
        if not upload_result:
            raise HTTPException(status_code=500, detail="Failed to upload image to any IPFS service.")
        return upload_result
    finally:
        os.remove(temp_file_path)  # Clean up the temporary file

# Endpoint for creating an auction
from datetime import datetime
import aiofiles
import os
import json
from fastapi import HTTPException

@app.post("/create_auction/")
async def create_auction(data: AuctionData, current_user: dict = Depends(get_current_user)):
    try:
        user_id = str(current_user["_id"])

        # Prepare auction data
        auction_info = {
            "title": data.title,
            "description": data.description,
            "start_date": data.start_date.isoformat(),
            "end_date": data.end_date.isoformat(),
            "map_url": data.map_url,
            "coordinates": data.coordinates,
            "predicted_score": str(data.predicted_score),
            "total_carbon_tonnage": str(data.total_carbon_tonnage),
            "estimated_cost_per_ton": str(data.estimated_cost_per_ton),
            "total_estimated_cost": str(data.total_estimated_cost),
            "carbon_credit_amount": str(data.carbon_credit_amount),
            "min_carbon_credit": str(data.min_carbon_credit),
            "max_carbon_credit": str(data.max_carbon_credit),
            "created_at": datetime.now().isoformat(),
            "creator_id": user_id,
            "creator_address": current_user["celoAddress"],
            "creator_username": current_user["username"]
        }

        # Upload auction data to IPFS
        async with aiofiles.tempfile.NamedTemporaryFile(delete=False, suffix=".json") as temp_file:
            await temp_file.write(json.dumps(auction_info).encode("utf-8"))
            temp_file_path = temp_file.name

        try:
            upload_result = await upload_file_with_backup(temp_file_path)
            if not upload_result:
                raise HTTPException(status_code=500, detail="Failed to upload auction data to IPFS.")
            auction_info["ipfs_hash"] = upload_result["ipfs_url"]
            auction_info["ipfs_source"] = upload_result["source"]
        finally:
            os.remove(temp_file_path)

        # Save auction in the database
        result = await auctions_collection.insert_one(auction_info)
        auction_info["_id"] = str(result.inserted_id)

        # Response with key details
        return {
            "message": "Auction created successfully",
            "auction_id": auction_info["_id"],
            "ipfs_hash": auction_info["ipfs_hash"],
            "ipfs_source": auction_info["ipfs_source"],
            "auction_info": {
                "title": auction_info["title"],
                "description": auction_info["description"],
                "start_date": auction_info["start_date"],
                "end_date": auction_info["end_date"],
                "map_url": auction_info["map_url"],
                "coordinates": auction_info["coordinates"],
                "predicted_score": auction_info["predicted_score"],
                "total_carbon_tonnage": auction_info["total_carbon_tonnage"],
                "estimated_cost_per_ton": auction_info["estimated_cost_per_ton"],
                "total_estimated_cost": auction_info["total_estimated_cost"],
                "carbon_credit_amount": auction_info["carbon_credit_amount"],
                "min_carbon_credit": auction_info["min_carbon_credit"],
                "max_carbon_credit": auction_info["max_carbon_credit"],
                "creator_id": auction_info["creator_id"],
                "creator_address": auction_info["creator_address"],
                "creator_username": auction_info["creator_username"]
            }
        }

    except ValidationError as e:
        print(f"Validation error: {e.json()}")
        raise HTTPException(status_code=422, detail="Invalid input data")
    except Exception as e:
        print("Error creating auction:", e)
        raise HTTPException(status_code=500, detail=f"Failed to create auction: {str(e)}")

from fastapi.exceptions import RequestValidationError

from starlette.requests import Request

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    # Ensure all error details are JSON-serializable
    errors = []
    for error in exc.errors():
        error_detail = {
            "type": error.get("type"),
            "loc": error.get("loc"),
            "msg": error.get("msg"),
            "input": error.get("input"),
            "ctx": error.get("ctx"),
        }
        # Serialize context errors like ValueError to strings
        if error_detail["ctx"] and isinstance(error_detail["ctx"].get("error"), Exception):
            error_detail["ctx"]["error"] = str(error_detail["ctx"]["error"])
        errors.append(error_detail)

    return JSONResponse(
        status_code=422,
        content={"detail": errors},
    )

@app.post("/explain_calculation/")
async def explain_calculation(data: CalculationExplanationRequest) -> dict:
    """
    Explain how the carbon credit amount is calculated based on predicted score and total carbon tonnage.
    """
    try:
        # Constants
        COST_PER_TON_KES = Decimal("50000")  # Cost per ton in KES
        BUFFER_PERCENTAGE = Decimal("1.3")  # 130% for maximum range

        # Calculations
        estimated_cost_per_ton = data.predicted_score * COST_PER_TON_KES
        total_estimated_cost = (estimated_cost_per_ton * data.total_carbon_tonnage).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Calculate minimum and maximum allowable carbon credit amounts
        min_carbon_credit = total_estimated_cost
        max_carbon_credit = (total_estimated_cost * BUFFER_PERCENTAGE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Choose a recommended credit amount (e.g., 110% of estimated cost)
        recommended_credit_amount = (total_estimated_cost * Decimal("1.1")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Explanation response
        explanation = {
            "input_values": {
                "predicted_score": str(data.predicted_score),
                "total_carbon_tonnage": str(data.total_carbon_tonnage),
                "cost_per_ton_kes": str(COST_PER_TON_KES)
            },
            "calculated_values": {
                "estimated_cost_per_ton": str(estimated_cost_per_ton),
                "total_estimated_cost": str(total_estimated_cost),
                "min_carbon_credit": str(min_carbon_credit),
                "max_carbon_credit": str(max_carbon_credit),
                "recommended_credit_amount": str(recommended_credit_amount)
            },
            "explanation_steps": [
                "1. Calculate the estimated cost per ton: estimated_cost_per_ton = predicted_score * COST_PER_TON_KES",
                "2. Calculate the total estimated cost: total_estimated_cost = estimated_cost_per_ton * total_carbon_tonnage",
                "3. Set minimum carbon credit to the total estimated cost.",
                "4. Set maximum carbon credit as 130% of the total estimated cost to allow a 30% buffer.",
                "5. Recommend a carbon credit amount at 110% of the total estimated cost to account for project variations."
            ]
        }

        return {
            "message": "Carbon credit amount calculation explained successfully.",
            "explanation": explanation
        }

    except Exception as e:
        print("Error explaining calculation:", e)
        raise HTTPException(status_code=500, detail="Failed to explain calculation.")


# Endpoint to retrieve the most recently created auction by the logged-in user
@app.get("/my-latest-auction/")
async def get_latest_user_auction(current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])

    # Find the most recent auction created by the user, sorted by "created_at" in descending order
    latest_auction = await auctions_collection.find_one(
        {"creator_id": user_id},
        sort=[("created_at", -1)]
    )

    # If no auctions were found for the user
    if not latest_auction:
        raise HTTPException(status_code=404, detail="No auctions found for the current user")

    # Convert ObjectId to string for JSON serialization and add creator details
    latest_auction["_id"] = str(latest_auction["_id"])
    latest_auction["creator_info"] = {
        "username": current_user["username"],
        "celoAddress": current_user["celoAddress"]
    }

    return {"latest_auction": latest_auction}

# Endpoint to retrieve all auctions created by the current logged-in user
@app.get("/my-auctions/")
async def get_user_auctions(current_user: dict = Depends(get_current_user), page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    skip = (page - 1) * limit
    user_id = str(current_user["_id"])

    # Fetch auctions where the creator_id matches the current user's ID
    auctions = await auctions_collection.find({"creator_id": user_id}).skip(skip).limit(limit).to_list(length=limit)

    # Convert ObjectId to string for JSON serialization and add creator details
    for auction in auctions:
        auction["_id"] = str(auction["_id"])
        auction["creator_info"] = {
            "username": current_user["username"],
            "celoAddress": current_user["celoAddress"]
        }

    return {"auctions": auctions, "page": page, "limit": limit, "total_auctions": len(auctions)}

# Endpoint to fetch all auctions with pagination
@app.get("/auctions/")
async def get_auctions(page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100)):
    skip = (page - 1) * limit
    auctions = await auctions_collection.find().skip(skip).limit(limit).to_list(length=limit)

    # Create a dictionary to hold user details to avoid redundant database calls
    user_details_cache = {}

    # Convert ObjectId to string for JSON serialization and add creator details
    for auction in auctions:
        auction["_id"] = str(auction["_id"])

        # Fetch the creator's details only if not already fetched
        creator_id = auction.get("creator_id")
        if creator_id and creator_id not in user_details_cache:
            creator = await users_collection.find_one({"_id": ObjectId(creator_id)})
            if creator:
                creator_info = {
                    "username": creator["username"],
                    "celoAddress": creator["celoAddress"]
                }

                # Count the number of auctions created by this user
                auction_count = await auctions_collection.count_documents({"creator_id": creator_id})
                creator_info["auction_count"] = auction_count

                # Cache the creator details for reuse
                user_details_cache[creator_id] = creator_info
            else:
                raise HTTPException(status_code=404, detail="Creator not found")

        # Attach the cached creator details to the auction
        auction["creator_info"] = user_details_cache.get(creator_id, {})
    
    return {"auctions": auctions, "page": page, "limit": limit}


# Constants for maximum bid percentage and minimum increment
MAX_BID_PERCENTAGE = Decimal("600.00")  # Max bid is 600.00% of carbon credit amount
MINIMUM_BID_INCREMENT = Decimal("0.05")  # 5% increment on the highest bid
MAX_BIDS_PER_USER = 3  # Limit of bids per user per auction


# Helper function to check if a user has sufficient balance
async def check_user_balance(current_user: dict, required_amount: float) -> bool:
    # Check for both 'celo_address' and 'celoAddress' keys
    celo_address = current_user.get("celo_address") or current_user.get("celoAddress")
    if not celo_address:
        raise HTTPException(status_code=500, detail="Celo address missing for current user")

    balance_info = check_and_get_balance(celo_address)
    if not balance_info:
        raise HTTPException(status_code=500, detail="Error retrieving Celo balance")

    # Convert balance in Wei to CELO
    balance_celo = Decimal(balance_info["balance"]) / Decimal(1e18)

    # Log balance in USD and KES for verification
    balance_usd = balance_celo * CELO_TO_USD
    balance_kes = balance_celo * CELO_TO_KES
    print(f"User's Celo Balance: {balance_celo} CELO == ${balance_usd} == {balance_kes} KES")

    return balance_celo >= Decimal(required_amount)

# Endpoint to place a bid with a bid limit and carbon credit constraints
@app.post("/place_bid/")
async def place_bid(bid: BidData, current_user: dict = Depends(get_current_user)):
    try:
        print(f"Received bid: {bid}, User: {current_user}")
        # Fetch the auction
        auction = await auctions_collection.find_one({"_id": ObjectId(bid.auction_id)})
        if not auction:
            raise HTTPException(status_code=404, detail="Auction not found")

        # Prevent self-bidding
        if auction["creator_id"] == str(current_user["_id"]):
            raise HTTPException(status_code=400, detail="You cannot bid on your own auction")

        # Check if the auction has ended
        end_date = datetime.fromisoformat(auction['end_date'])
        if datetime.now() > end_date:
            raise HTTPException(status_code=400, detail="The auction has already ended")

        # Check the user's number of bids on this auction
        user_bids_count = await bids_collection.count_documents({
            "auction_id": bid.auction_id,
            "bidder_id": str(current_user["_id"])
        })
        if user_bids_count >= MAX_BIDS_PER_USER:
            raise HTTPException(
                status_code=400,
                detail=f"You have reached the limit of {MAX_BIDS_PER_USER} bids on this auction."
            )

        # Carbon credit boundaries for the bid
        min_bid_amount = Decimal(auction["carbon_credit_amount"])
        max_bid_amount = min_bid_amount * MAX_BID_PERCENTAGE

        # Validate bid amount within bounds
        if Decimal(bid.bid_amount) < min_bid_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Bid amount must be at least the carbon credit amount of {min_bid_amount}."
            )
        if Decimal(bid.bid_amount) > max_bid_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Bid amount cannot exceed 130% of the carbon credit amount ({max_bid_amount})."
            )

        # Check the current highest bid and enforce minimum increment
        highest_bid = await bids_collection.find_one(
            {"auction_id": bid.auction_id},
            sort=[("bid_amount", -1)]
        )
        if highest_bid:
            min_required_bid = Decimal(highest_bid["bid_amount"]) * (1 + MINIMUM_BID_INCREMENT)
            if Decimal(bid.bid_amount) < min_required_bid:
                raise HTTPException(
                    status_code=400,
                    detail=f"Bid must be at least 5% higher than the current highest bid of {highest_bid['bid_amount']} CELO."
                )

        # Check if user has enough balance
        required_balance = bid.bid_amount
        if not await check_user_balance(current_user, required_balance):
            raise HTTPException(status_code=400, detail="Insufficient balance to place bid")

        # Place the bid
        bid_data = {
            "auction_id": bid.auction_id,
            "bidder_id": str(current_user["_id"]),
            "bidder_address": current_user.get("celo_address") or current_user.get("celoAddress"),
            "bid_amount": bid.bid_amount,
            "bid_time": datetime.now().isoformat(),
        }
        await bids_collection.insert_one(bid_data)

        return {"message": "Bid placed successfully"}

    except Exception as e:
        print(f"Error placing bid: {e}")
        raise HTTPException(status_code=500, detail=f"Error placing bid: {str(e)}")

@app.get("/highest_bid/{auction_id}")
async def get_highest_bid(auction_id: str):
    try:
        # Validate auction ID format
        if not ObjectId.is_valid(auction_id):
            raise HTTPException(status_code=400, detail="Invalid auction ID format")

        # Fetch the auction
        auction = await auctions_collection.find_one({"_id": ObjectId(auction_id)})
        if not auction:
            raise HTTPException(status_code=404, detail="Auction not found")

        # Check if auction is active
        end_date = datetime.fromisoformat(auction['end_date'])
        is_active = datetime.now() <= end_date

        # Fetch the highest bid
        highest_bid = await bids_collection.find_one(
            {"auction_id": auction_id},
            sort=[("bid_amount", -1)]
        )
        bid_count = await bids_collection.count_documents({"auction_id": auction_id})

        return {
            "auction_id": str(auction["_id"]),
            "is_active": is_active,
            "end_date": auction["end_date"],
            "highest_bid": highest_bid,
            "bid_count": bid_count,
            "message": "Auction is active and accepting bids" if is_active else "Auction has ended"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve highest bid: {str(e)}")


# Endpoint to fetch the highest bid for an auction
@app.get("/highest_bid/{auction_id}")
async def get_highest_bid(auction_id: str):
    try:
        print(f"Fetching highest bid for auction ID: {auction_id}")
        highest_bid = await bids_collection.find_one(
            {"auction_id": auction_id},
            sort=[("bid_amount", -1)]
        )
        bid_count = await bids_collection.count_documents({"auction_id": auction_id})

        if not highest_bid:
            print("No bids found for this auction.")
            return {"message": "No bids found for this auction", "bid_count": bid_count}

        highest_bid["_id"] = str(highest_bid["_id"])
        highest_bid["auction_id"] = str(highest_bid["auction_id"])

        print(f"Highest bid found: {highest_bid}")
        return {
            "highest_bid": highest_bid,
            "bid_count": bid_count,
            "bidder_address": highest_bid["bidder_address"]
        }
    except Exception as e:
        print(f"Error retrieving highest bid: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve highest bid: {str(e)}")

@app.get("/auction_details/{auction_id}")
async def get_auction_details(auction_id: str):
    try:
        # Validate auction_id format
        if not ObjectId.is_valid(auction_id):
            raise HTTPException(status_code=400, detail="Invalid auction ID format")

        # Fetch the auction by ID
        auction = await auctions_collection.find_one({"_id": ObjectId(auction_id)})
        if not auction:
            raise HTTPException(status_code=404, detail="Auction not found")

        # Fetch highest bid details
        highest_bid = await bids_collection.find_one(
            {"auction_id": auction_id}, sort=[("bid_amount", -1)]
        )
        bid_count = await bids_collection.count_documents({"auction_id": auction_id})

        # Handle start and end dates
        start_date = auction.get("start_date")
        end_date = auction.get("end_date")

        formatted_start_date = start_date if start_date else "Invalid Date"
        formatted_end_date = end_date if end_date else "Invalid Date"

        # Carbon credit boundaries for the bid
        min_bid_amount = Decimal(auction["carbon_credit_amount"])
        max_bid_amount = min_bid_amount * MAX_BID_PERCENTAGE

        return {
            "auction": {
                "id": str(auction["_id"]),
                "title": auction["title"],
                "description": auction["description"],
                "start_date": formatted_start_date,
                "end_date": formatted_end_date,
                "satelliteImageUrl": auction.get("map_url"),
                "carbonCredit": auction.get("carbon_credit_amount"),
                "predicted_score": auction.get("predicted_score"),
                "startingBid": str(min_bid_amount) + " KES",
                "creator": auction.get("creator_username", "Unknown"),
                "creator_address": auction.get("creator_address", "N/A"),
            },
            "highest_bid": highest_bid,
            "total_bids": bid_count,
        }

    except HTTPException as e:
        print(f"Error in get_auction_details: {str(e)}")
        raise e
    except Exception as e:
        print(f"Unexpected error in get_auction_details: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")


import asyncio
import json
import os
from datetime import datetime
from fastapi import HTTPException
from typing import Dict, Any
from decimal import Decimal
from web3 import Web3
from pymongo import MongoClient
import logging

# Initialize logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize web3
web3 = Web3(Web3.HTTPProvider("https://alfajores-forno.celo-testnet.org"))

def execute_transfer_js_script(recipient_address: str, wei_amount: int) -> Dict[str, Any]:
    try:
        result = subprocess.run(
            ["node", "transferCkes.js", recipient_address, str(wei_amount)],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            logger.error(f"Error executing transfer script: {result.stderr.strip()}")
            return {"status": "error", "error": result.stderr.strip() or "Unknown error"}

        output = json.loads(result.stdout.strip())
        return output

    except json.JSONDecodeError:
        logger.error("JSON decode error: Transfer script output was not valid JSON.")
        return {"status": "error", "error": "Invalid JSON output from transfer script"}
    except Exception as e:
        logger.error(f"Unexpected error in execute_transfer_js_script: {e}")
        return {"status": "error", "error": str(e)}


async def transfer_funds_and_carbon_credits(
    winner_address: str,
    owner_address: str,
    bid_amount: Decimal,
    carbon_credit_amount: Decimal
) -> Dict[str, Any]:
    try:
        bid_amount_wei = web3.to_wei(bid_amount, 'ether')
        fund_transfer_result = execute_transfer_js_script(owner_address, bid_amount_wei)
        
        if fund_transfer_result["status"] != "success":
            raise HTTPException(status_code=500, detail="CELO transfer failed")
        
        # Separate block for contract interaction
        try:
            contract_address = os.getenv("CARBON_CREDIT_CONTRACT_ADDRESS")
            with open(".json", "r") as f:
                contract_abi = json.load(f)
            contract = web3.eth.contract(address=contract_address, abi=contract_abi)

            carbon_amount_wei = web3.to_wei(carbon_credit_amount, 'ether')
            transfer_txn = contract.functions.transfer(winner_address, carbon_amount_wei).build_transaction({
                'from': owner_address,
                'nonce': web3.eth.get_transaction_count(owner_address, 'pending'),
                'gas': 100000,
                'gasPrice': web3.eth.gas_price
            })

            signed_txn = web3.eth.account.sign_transaction(transfer_txn, private_key=os.getenv("OWNER_PRIVATE_KEY"))
            tx_hash = web3.eth.send_raw_transaction(signed_txn.rawTransaction)
            tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash)

            if tx_receipt.status != 1:
                raise HTTPException(status_code=500, detail="Carbon credit transfer failed")

        except HTTPException as e:
            logger.error(f"Blockchain transfer error: {e}")
            raise e
        except Exception as e:
            logger.error(f"Unexpected error during contract interaction: {e}")
            raise HTTPException(status_code=500, detail="Error during carbon credit transfer")

        return {"status": "success", "message": "Transfer complete"}

    except HTTPException as e:
        logger.error(f"Error in transfer: {str(e)}")
        return {"status": "error", "message": str(e)}
    except Exception as e:
        logger.error(f"Unexpected error in transfer: {e}")
        return {"status": "error", "message": str(e)}

# Finalize Auction
async def finalize_auction(auction):
    try:
        auction_id = auction["_id"]
        auction_owner_address = auction["creator_address"]
        carbon_credit_amount = auction["carbon_credit_amount"]

        highest_bid = await bids_collection.find_one({"auction_id": str(auction_id)}, sort=[("bid_amount", -1)])

        if not highest_bid:
            await auctions_collection.update_one({"_id": auction_id}, {"$set": {"status": "no_bids"}})
            logger.info(f"Auction {auction_id} ended with no bids.")
            return

        winner_id = highest_bid["bidder_id"]
        winner_address = highest_bid["bidder_address"]
        bid_amount = Decimal(highest_bid["bid_amount"])

        # Transfer funds and carbon credits
        transfer_result = await transfer_funds_and_carbon_credits(winner_address, auction_owner_address, bid_amount, carbon_credit_amount)

        if transfer_result["status"] == "success":
            await auctions_collection.update_one({"_id": auction_id}, {"$set": {"status": "finalized", "winner_id": winner_id}})
            logger.info(f"Auction {auction_id} finalized successfully.")
        else:
            logger.error(f"Failed to finalize auction {auction_id}: {transfer_result['message']}")

    except Exception as e:
        logger.error(f"Error finalizing auction {auction['_id']}: {e}")

# Check and finalize auctions
async def check_and_finalize_auctions():
    try:
        current_time = datetime.utcnow()
        ended_auctions = await auctions_collection.find({
            "end_date": {"$lte": current_time.isoformat()},
            "status": {"$ne": "finalized"}
        }).to_list(length=100)

        for auction in ended_auctions:
            logger.info(f"Finalizing auction {auction['_id']}")
            await finalize_auction(auction)

    except Exception as e:
        logger.error(f"Error in auction finalizer: {e}")

# Periodic finalizer
async def auction_finalizer():
    while True:
        await check_and_finalize_auctions()
        await asyncio.sleep(60)
  # Check auctions every minute

@app.on_event("startup")
async def start_auction_finalizer():
    asyncio.create_task(auction_finalizer())


# Main entry point for FastAPI
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
