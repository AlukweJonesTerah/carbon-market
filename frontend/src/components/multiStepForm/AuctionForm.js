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
  const [feedback, setFeedback] = useState({ message: "", type: "" });

  useEffect(() => {
    // If coordinates, predictedScore, or mapUrl is missing, redirect back
    if (!coordinates || !predictedScore || !mapUrl) {
      setFeedback({
        message: "Please submit your coordinates before creating an auction.",
        type: "error",
      });
      // Redirect back to CoordinateForm after displaying the message
      setTimeout(() => {
        navigate("/coordinate-form");
      }, 3000);
    }
  }, [coordinates, predictedScore, mapUrl, navigate]);

  const today = new Date().toISOString().split("T")[0]; // Format to YYYY-MM-DD

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
      start_date: today,
      end_date: "",
    },
  });

  const watchStartDate = watch("start_date");
  const watchEndDate = watch("end_date");

  const isDateRangeValid = useMemo(() => {
    if (watchStartDate && watchEndDate) {
      return new Date(watchStartDate) < new Date(watchEndDate);
    }
    return true;
  }, [watchStartDate, watchEndDate]);

  useEffect(() => {
    const savedAuctionData = JSON.parse(localStorage.getItem("auctionData"));
    if (savedAuctionData) {
      Object.keys(savedAuctionData).forEach((key) => {
        setValue(key, savedAuctionData[key]);
      });
    }
  }, [setValue]);

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
      map_url: mapUrl,
      coordinates,
      predicted_score: predictedScore,
      total_carbon_tonnage: 1,
      carbon_credit_amount: 0,
      estimated_cost_per_ton: 0,
      total_estimated_cost: 0,
      min_carbon_credit: 0,
      max_carbon_credit: 0,
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
        const errorMessages = Array.isArray(errorData.detail)
          ? errorData.detail.map(
              (err) => `${err.msg} (Field: ${err.loc.join(" -> ")})`
            )
          : [errorData.detail];

        setFeedback({
          message: (
            <ul>
              {errorMessages.map((msg, index) => (
                <li key={index}>{msg}</li>
              ))}
            </ul>
          ),
          type: "error",
        });
        return;
      }

      const responseData = await response.json();
      setFeedback({ message: "Auction created successfully!", type: "success" });

      localStorage.removeItem("auctionData");
      reset();

      navigate(`/auction-card/${responseData.auction_id}`, {
        state: { ...responseData.auction_info, id: responseData.auction_id },
      });
    } catch (error) {
      console.error("Error creating auction:", error);
      setFeedback({ message: "An error occurred. Please try again.", type: "error" });
    }
  };

  const handleGoBack = () => {
    navigate("/coordinates", {
      state: { coordinates, predictedScore, mapUrl },
    });
  };

  return (
    <div className="auction-form-container">
      <h1>Create Carbon Credit Auction</h1>

      {feedback.message && (
        <div className={`feedback-message ${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      {(!coordinates || !predictedScore || !mapUrl) ? (
        <p>Redirecting to coordinate submission...</p>
      ) : (
        <>
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
              {errors.description && (
                <p className="error-text">{errors.description.message}</p>
              )}
            </div>

            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                defaultValue={today}
                {...register("start_date", { required: "Start date is required" })}
                className="form-input"
                // readOnly
              />
              {errors.start_date && (
                <p className="error-text">{errors.start_date.message}</p>
              )}
            </div>

            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                {...register("end_date", { required: "End date is required" })}
                className="form-input"
                min={today}
              />
              {errors.end_date && (
                <p className="error-text">{errors.end_date.message}</p>
              )}
              {!isDateRangeValid && (
                <p className="error-text">End date must be after start date</p>
              )}
            </div>

            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting || !isDateRangeValid}
            >
              {isSubmitting ? "Creating Auction..." : "Create Auction"}
            </button>
            <button onClick={handleGoBack} className="submit-button">
            Go Back to Edit Coordinates
          </button>
          </form>
        </>
      )}
    </div>
  );
};

export default AuctionForm;
