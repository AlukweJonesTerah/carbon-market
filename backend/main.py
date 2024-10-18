from fastapi import FastAPI, HTTPException
import requests
import cv2
import numpy as np
from tensorflow.lite.python.interpreter import Interpreter
from dotenv import load_dotenv
import os
from fastapi.middleware.cors import CORSMiddleware


# Load environment variables
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow your React app origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the TFLite model
interpreter = Interpreter(model_path='./model/model.tflite')
interpreter.allocate_tensors()

# Google Maps API key from .env file
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

@app.post("/process_coordinates/")
async def process_coordinates(coordinates: list):
    # Join the coordinates for Google Maps API
    joined_coordinates = "|".join(coordinates)
    
    # Fetch the satellite image using Google Maps Static API
    map_url = (
        f"https://maps.googleapis.com/maps/api/staticmap?size=400x400&maptype=satellite&"
        f"path=color:0xff0000ff|weight:5|{joined_coordinates}&key={GOOGLE_MAPS_API_KEY}"
    )
    
    response = requests.get(map_url)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail="Error fetching map image")

    # Convert the image to a NumPy array
    nparr = np.frombuffer(response.content, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Resize the image to the required input size for the model (256x256)
    img = cv2.resize(img, (256, 256)) / 255.0
    img = np.expand_dims(img, axis=0).astype(np.float32)

    # Set input tensor for the interpreter
    input_index = interpreter.get_input_details()[0]['index']
    interpreter.set_tensor(input_index, img)

    # Invoke the interpreter (make the prediction)
    interpreter.invoke()

    # Retrieve the prediction result
    output_index = interpreter.get_output_details()[0]['index']
    predicted_score = round(float(interpreter.get_tensor(output_index)[0][0]), 1)

    return {"predicted_score": predicted_score}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)