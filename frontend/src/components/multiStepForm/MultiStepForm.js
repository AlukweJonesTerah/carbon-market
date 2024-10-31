// frontend/src/components/multiStepForm/MultiStepForm.js

import React, { useState } from "react";
import CoordinateForm from "./CoordinateForm"; // Adjust the path here
import AuctionForm from "./AuctionForm"; // Adjust the path here

const MultiStepForm = () => {
  const [coordinates, setCoordinates] = useState(null);
  const [predictedScore, setPredictedScore] = useState(null);
  const [mapUrl, setMapUrl] = useState(null); // State to hold map URL
  const [step, setStep] = useState(1);

  const handleNext = (coords, score, url) => {
    setCoordinates(coords);
    setPredictedScore(score);
    setMapUrl(url); // Ensure map URL is correctly stored in state
    console.log("mapUrl in MultiStepForm:", url); // Log to check if mapUrl is being set
    setStep(2); // Move to the next step
  };

  return (
    <div>
      {step === 1 && <CoordinateForm onNext={handleNext} />}
      {step === 2 && (
        <AuctionForm 
          coordinates={coordinates} 
          predictedScore={predictedScore} 
          mapUrl={mapUrl} // Pass the map URL as a prop
        />
      )}
    </div>
  );
};

export default MultiStepForm;
