import React, { useState, useEffect, useContext, useCallback } from "react";
import { useForm } from "react-hook-form";
import { AiOutlineMinus, AiOutlinePlus, AiOutlineEnvironment } from "react-icons/ai";
import { FaMap, FaChevronRight } from "react-icons/fa";
import { PuffLoader } from "react-spinners";
import { AuthContext } from "./AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import "../../styles/CoordinateForm.css";

const CoordinateForm = ({ onNext }) => {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [inputQuantity, setInputQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [mapUrl, setMapUrl] = useState(null);
  const [predictedScore, setPredictedScore] = useState(null);
  const [coordinatesState, setCoordinatesState] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      coordinates: [""],
    },
  });

  const watchCoordinates = watch("coordinates");

  useEffect(() => {
    if (!token) {
      setErrorMessage("You are not logged in. Please log in to create an auction.");
      navigate("/Login");
    }
  }, [navigate, token]);

  useEffect(() => {
    const savedCoordinateData = JSON.parse(localStorage.getItem("coordinateData"));
    if (savedCoordinateData) {
      setValue("coordinates", savedCoordinateData.coordinates || [""]);
      setInputQuantity(
        savedCoordinateData.coordinates ? savedCoordinateData.coordinates.length : 1
      );
      setPredictedScore(savedCoordinateData.predictedScore || null);
      setMapUrl(savedCoordinateData.mapUrl || null);
    }
  }, [setValue]);

  const increaseInput = () => setInputQuantity((prev) => prev + 1);

  const decreaseInput = useCallback(() => {
    if (inputQuantity > 1) {
      setInputQuantity((prev) => prev - 1);
      const updatedCoordinates = watchCoordinates.slice(0, -1);
      setValue("coordinates", updatedCoordinates);
    }
  }, [inputQuantity, watchCoordinates, setValue]);

  const isValidCoordinate = (coordinate) => {
    const coordinateRegex =
      /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?((1[0-7]\d)|([1-9]?\d))(\.\d+)?$/;
    return coordinateRegex.test(coordinate);
  };

  const onSubmit = async (data) => {
    const invalidCoordinates = data.coordinates.filter((coord) => !isValidCoordinate(coord.trim()));

    if (invalidCoordinates.length > 0) {
      setErrorMessage("Please enter valid coordinates in the format: latitude, longitude");
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      if (!token) {
        setErrorMessage("You are not logged in. Please log in to create an auction.");
        navigate("/Login");
        return;
      }

      const response = await fetch("http://localhost:8000/process_coordinates/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          coordinates: data.coordinates.map((coord) => coord.trim()),
        }),
      });

      if (response.status === 401) {
        setErrorMessage("Session expired. Redirecting to login...");
        localStorage.removeItem("token");
        navigate("/Login");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        setErrorMessage(errorData.detail || "An error occurred while processing coordinates.");
        throw new Error(`Error: ${response.status} - ${response.statusText}`);
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
      console.error("Failed to process coordinates:", error);
      setErrorMessage("Failed to process the coordinates. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRedirect = () => {
    if (!mapUrl || !predictedScore) {
      setErrorMessage("Please submit valid coordinates and process them before proceeding.");
    } else {
      navigate("/create-auction", {
        state: { coordinates: coordinatesState, predictedScore, mapUrl },
      });
    }
  };

  return (
    <div className="coordinate-form">
      <h4 className="form-title">
        <AiOutlineEnvironment className="title-icon" />
        Choose Coordinates of Your Preservation Area
      </h4>
      <form onSubmit={handleSubmit(onSubmit)} className="coordinate-inputs">
        {[...Array(inputQuantity)].map((_, index) => (
          <div key={index} className="coordinate-input-wrapper">
            <input
              key={index}
              className={`coordinate-input ${errors.coordinates?.[index] ? "input-error" : ""}`}
              placeholder={`Coordinate ${index + 1} (e.g., 40.7128, -74.0060)`}
              {...register(`coordinates[${index}]`, {
                required: "Coordinate is required",
                validate: (value) =>
                  isValidCoordinate(value.trim()) || "Invalid coordinate format",
              })}
            />
            {errors.coordinates?.[index] && (
              <span className="error-text">{errors.coordinates[index].message}</span>
            )}
          </div>
        ))}
        <div className="button-group">
          <button
            type="button"
            onClick={increaseInput}
            className="btn-icon"
            aria-label="Add coordinate input"
            title="Add Coordinate"
          >
            <AiOutlinePlus />
          </button>
          <button
            type="button"
            onClick={decreaseInput}
            className="btn-icon"
            aria-label="Remove coordinate input"
            title="Remove Coordinate"
            disabled={inputQuantity <= 1}
          >
            <AiOutlineMinus />
          </button>
        </div>
        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? (
            <>
              <PuffLoader size={20} color="white" />
              Processing...
            </>
          ) : (
            <>
              <FaMap /> Submit Coordinates
            </>
          )}
        </button>
      </form>

      {errorMessage && <p className="error-message">{errorMessage}</p>}

      {mapUrl && (
        <div className="map-preview">
          <img src={mapUrl} alt="Satellite View" className="map-image" />
        </div>
      )}

      {predictedScore && (
        <div className="score-container">
          <p className="predicted-score">Predicted Carbon Credits: {predictedScore}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleRedirect}
        className="auction-button"
        disabled={!mapUrl || !predictedScore}
      >
        Go to Auction Creation <FaChevronRight />
      </button>
    </div>
  );
};

export default CoordinateForm;
