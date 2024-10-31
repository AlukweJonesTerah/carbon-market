import React, { useState, useEffect, useContext } from "react";
import { useForm } from "react-hook-form";
import { SemipolarLoading } from "react-loadingg";
import { AiOutlineMinus, AiOutlinePlus } from "react-icons/ai";
import { AuthContext } from './AuthContext';
import { useNavigate } from "react-router-dom";
import '../../styles/CoordinateForm.css';
const CoordinateForm = ({ onNext }) => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [inputQuantity, setInputQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [mapUrl, setMapUrl] = useState(null);
  const [predictedScore, setPredictedScore] = useState(null);
  const [coordinatesState, setCoordinatesState] = useState([]);

  const { register, handleSubmit, setValue } = useForm({
    defaultValues: {
      coordinates: [""],
    },
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMessage("You are not logged in. Please log in to create an auction.");
      navigate("/Login");
    }
  }, [navigate]);

  useEffect(() => {
    const savedCoordinateData = JSON.parse(localStorage.getItem("coordinateData"));
    if (savedCoordinateData) {
      setValue("coordinates",  [""]); // savedCoordinateData.coordinates ||
      setInputQuantity(savedCoordinateData.coordinates ? savedCoordinateData.coordinates.length : 1);
      setPredictedScore(savedCoordinateData.predictedScore || null);
      setMapUrl(savedCoordinateData.mapUrl || null);
    }
  }, [setValue]);

  const increaseInput = () => setInputQuantity((prev) => prev + 1);
  const decreaseInput = () => inputQuantity > 1 && setInputQuantity((prev) => prev - 1);

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setErrorMessage("You are not logged in. Please log in to create an auction.");
        navigate("/Login");
        return;
      }

      const response = await fetch("http://localhost:8000/process_coordinates/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ coordinates: data.coordinates }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setErrorMessage("Unauthorized access. Please log in again.");
          localStorage.removeItem("token");
          navigate("/Login");
          return;
        }
        const errorData = await response.json();
        setErrorMessage(errorData.detail || "An error occurred");
        console.error("Backend error response:", errorData);
        throw new Error(`Failed to process coordinates: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      setPredictedScore(result.predicted_score);
      setMapUrl(result.map_url);
      setCoordinatesState(data.coordinates);

      localStorage.setItem(
        "coordinateData",
        JSON.stringify({
          coordinates: data.coordinates,
          predictedScore: result.predicted_score,
          mapUrl: result.map_url,
        })
      );

      if (onNext) onNext(data.coordinates, result.predicted_score, result.map_url);

    } catch (error) {
      setErrorMessage("Failed to process the coordinates. Please try again.");
      console.error("Error processing coordinates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedirect = () => {
    if (!mapUrl || !predictedScore) {
      setErrorMessage("Please submit the coordinates first.");
    } else {
      navigate("/create-auction", {
        state: { coordinates: coordinatesState, predictedScore, mapUrl },
      });
    }
  };

  return (
    <div className="coordinate-form">
      <h4 className="form-title">Choose the Coordinates of Your Preservation Area</h4>
      <form onSubmit={handleSubmit(onSubmit)} className="coordinate-inputs">
        {[...Array(inputQuantity)].map((_, index) => (
          <input
            key={index}
            className="coordinate-input"
            placeholder={`Coordinate ${index + 1}`}
            {...register(`coordinates[${index}]`, { required: true })}
          />
        ))}
        <div className="button-group">
          <button type="button" onClick={increaseInput} className="btn-icon">
            <AiOutlinePlus />
          </button>
          <button type="button" onClick={decreaseInput} className="btn-icon">
            <AiOutlineMinus />
          </button>
        </div>
        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? "Processing..." : "Submit"}
        </button>
      </form>

      {loading && <div className="loading-spinner"><SemipolarLoading size={"large"} color={"#00cc66"} /></div>}

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {mapUrl && <img src={mapUrl} alt="Satellite View" className="map-image" />}

      {predictedScore && <p className="predicted-score">Predicted Carbon Credits: {predictedScore}</p>}

      <button type="button" onClick={handleRedirect} className="auction-button">
        Go to Auction Creation
      </button>
    </div>
  );
};

export default CoordinateForm;
