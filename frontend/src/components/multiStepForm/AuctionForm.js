import React, { useEffect, useState, useContext, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";
import "../../styles/AuctionForm.css";

const AuctionForm = () => {
  const { token } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const { coordinates, predictedScore, mapUrl } = location.state || {};

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      title: "",
      description: "",
      start_date: "",
      end_date: "",
      carbon_credit_amount: "",
    },
  });

  const [feedback, setFeedback] = useState({ message: "", type: "" });

  const watchStartDate = watch("start_date");
  const watchEndDate = watch("end_date");

  const isDateRangeValid = useMemo(() => {
    if (watchStartDate && watchEndDate) {
      return new Date(watchStartDate) < new Date(watchEndDate);
    }
    return true;
  }, [watchStartDate, watchEndDate]);

  useEffect(() => {
    const subscription = watch((formValues) => {
      localStorage.setItem("auctionData", JSON.stringify(formValues));
    });

    const savedAuctionData = JSON.parse(localStorage.getItem("auctionData"));
    if (savedAuctionData) {
      Object.keys(savedAuctionData).forEach((key) => {
        setValue(key, savedAuctionData[key]);
      });
    }

    return () => subscription.unsubscribe();
  }, [watch, setValue]);

  const onSubmit = async (data) => {
    setFeedback({ message: "", type: "" });

    if (!token) {
      setFeedback({ message: "Please log in to create an auction.", type: "error" });
      return;
    }

    if (!coordinates || !mapUrl) {
      setFeedback({ message: "Location data is missing.", type: "error" });
      return;
    }

    if (!isDateRangeValid) {
      setFeedback({ message: "End date must be after the start date.", type: "error" });
      return;
    }

    const auctionData = {
      title: data.title.trim(),
      description: data.description.trim(),
      start_date: data.start_date,
      end_date: data.end_date,
      coordinates,
      predicted_score: predictedScore,
      map_url: mapUrl,
      carbon_credit_amount: parseFloat(data.carbon_credit_amount),
    };

    try {
      const response = await fetch("http://localhost:8000/create_auction/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(auctionData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setFeedback({
          message: errorData?.detail?.[0]?.msg || "Failed to create auction.",
          type: "error",
        });
        return;
      }

      const responseData = await response.json();
      setFeedback({ message: "Auction created successfully!", type: "success" });

      localStorage.removeItem("auctionData");
      reset();

      navigate(`/auction-card/${responseData.auction_id}`, {
        state: { ...auctionData, id: responseData.auction_id },
      });
    } catch (error) {
      console.error("Error creating auction:", error);
      setFeedback({ message: "An error occurred. Please try again.", type: "error" });
    }
  };

  return (
    <div className="auction-form-container">
      <h1>Create Carbon Credit Auction</h1>
      {predictedScore && (
        <div className="info-box">
          Predicted Carbon Credits: <strong>{predictedScore.toFixed(2)}</strong>
        </div>
      )}
      {feedback.message && (
        <div className={`feedback-message ${feedback.type}`}>
          {feedback.message}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="auction-form">
        <div className="form-group">
          <input
            {...register("title", { required: "Title is required" })}
            placeholder="Auction Title"
            className="form-input"
          />
          {errors.title && <p className="error-text">{errors.title.message}</p>}
        </div>

        <div className="form-group">
          <textarea
            {...register("description", { required: "Description is required" })}
            placeholder="Auction Description"
            className="form-textarea"
          />
          {errors.description && <p className="error-text">{errors.description.message}</p>}
        </div>

        <div className="form-group">
          <label>Start Date</label>
          <input
            type="date"
            {...register("start_date", { required: "Start date is required" })}
            className="form-input"
          />
          {errors.start_date && <p className="error-text">{errors.start_date.message}</p>}
        </div>

        <div className="form-group">
          <label>End Date</label>
          <input
            type="date"
            {...register("end_date", { required: "End date is required" })}
            className="form-input"
          />
          {errors.end_date && <p className="error-text">{errors.end_date.message}</p>}
          {!isDateRangeValid && <p className="error-text">End date must be after start date</p>}
        </div>

        <div className="form-group">
          <input
            type="number"
            {...register("carbon_credit_amount", { required: "Amount is required" })}
            placeholder="Carbon Credit Amount"
            className="form-input"
          />
          {errors.carbon_credit_amount && <p className="error-text">{errors.carbon_credit_amount.message}</p>}
        </div>

        <button type="submit" className="submit-button" disabled={isSubmitting || !isDateRangeValid}>
          {isSubmitting ? "Creating Auction..." : "Create Auction"}
        </button>
      </form>
    </div>
  );
};

export default AuctionForm;
