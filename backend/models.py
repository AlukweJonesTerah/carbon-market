from pydantic import BaseModel, EmailStr, Field, PositiveFloat
from typing import Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str 
    email: EmailStr
    password: str  # Accept password instead of hashed_password

    class Config:
        schema_extra = {
            "example": {
                "username": "john_doe",
                "email": "john@example.com",
                "password": "strongpassword"
            }
        }

class KYCDetails(BaseModel):
    user_id: str
    full_name: str
    date_of_birth: str
    address: str
    id_number: str
    front_id_card: Optional[str]
    back_id_card: Optional[str]
    
class UserInDB(UserCreate):
    id: Optional[str]
    hashed_password: str

class LoginData(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    message: str
    celoAddress: str
    access_token: str

class RecovoryData(BaseModel):
    email: EmailStr
    password: str

class CKESRequest(BaseModel):
    user_id: str
    requested_amount: PositiveFloat  # Ensures the amount is a positive float
    payment_amount: float    # Equivalent or higher amount in local currency (KES)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    status: str = "pending"  # Status: pending, approved, rejected
    admin_notes: Optional[str] = None

class AdminApproval(BaseModel):
    request_id: str
    approved: bool
    admin_notes: Optional[str] = None

class TokenData(BaseModel):
    username: str
    role: str