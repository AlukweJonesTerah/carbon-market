import React, { useEffect, useState, useContext } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from './AuthContext';
import '../../styles/AuctionForm.css';

const formatDate = (dateString) => dateString.split("T")[0];

const AuctionForm = () => {
  const { token } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const { coordinates, predictedScore, mapUrl } = location.state || {};

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const savedAuctionData = JSON.parse(localStorage.getItem("auctionData"));
    if (savedAuctionData) {
      for (const key in savedAuctionData) {
        setValue(key, savedAuctionData[key]);
      }
    }
  }, [setValue]);

  const onSubmit = async (data) => {
    if (!token) {
      setErrorMessage("Authentication failed. Please log in again.");
      return;
    }

    if (!coordinates || !mapUrl) {
      setErrorMessage("Missing necessary data (coordinates or map URL).");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const auctionData = {
      title: data.title,
      description: data.description,
      start_date: formatDate(data.start_date),
      end_date: formatDate(data.end_date),
      coordinates: coordinates,  // Pass as array if backend expects list of coordinates
      predicted_score: predictedScore,
      map_url: mapUrl,
      carbon_credit_amount: parseFloat(data.carbon_credit_amount),
    };

    console.log("Auction Data being sent:", auctionData);

    try {
      const response = await fetch("http://localhost:8000/create_auction/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(auctionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrorMessage(errorData?.detail?.[0]?.msg || "Failed to create auction.");
        throw new Error(`Backend error: ${response.statusText}`);
      }

      const responseData = await response.json();
      setSuccessMessage("Auction created successfully!");
      reset();
      localStorage.removeItem("auctionData");
      navigate(`/auction-card/${responseData.auction_id}`, {
        state: { ...auctionData, id: responseData.auction_id },
      });

    } catch (error) {
      console.error("Error creating auction:", error);
      setErrorMessage("Failed to create the auction. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auction-form-container">
      <h4>Enter Auction Details</h4>
      {predictedScore && <p className="info-text">Predicted Carbon Credits: {predictedScore}</p>}
      <form onSubmit={handleSubmit(onSubmit)} className="auction-form">
        <div className="form-group">
          <input {...register("title", { required: "Title is required" })} placeholder="Auction Title" className="form-input" />
          {errors.title && <p className="error-text">{errors.title.message}</p>}
        </div>

        <div className="form-group">
          <textarea {...register("description", { required: "Description is required" })} placeholder="Auction Description" className="form-textarea" />
          {errors.description && <p className="error-text">{errors.description.message}</p>}
        </div>

        <div className="form-group">
          <label>Start Date</label>
          <input type="date" {...register("start_date", { required: "Start date is required" })} className="form-input" />
          {errors.start_date && <p className="error-text">{errors.start_date.message}</p>}
        </div>

        <div className="form-group">
          <label>End Date</label>
          <input type="date" {...register("end_date", { required: "End date is required" })} className="form-input" />
          {errors.end_date && <p className="error-text">{errors.end_date.message}</p>}
        </div>

        <div className="form-group">
          <input type="number" {...register("carbon_credit_amount", { required: "Carbon Credit Amount is required" })} placeholder="Amount of Carbon Credits" className="form-input" />
          {errors.carbon_credit_amount && <p className="error-text">{errors.carbon_credit_amount.message}</p>}
        </div>

        <div className="button-group">
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? "Creating Auction..." : "Create Auction"}
          </button>
        </div>
      </form>

      {errorMessage && <p className="error-text">{errorMessage}</p>}
      {successMessage && <p className="success-text">{successMessage}</p>}
    </div>
  );
};

export default AuctionForm;
