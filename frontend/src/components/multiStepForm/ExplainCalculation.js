import axios from "axios";
import React, { useState } from "react";
import "./ExplainCalculation.css"; // Link to the provided styles

const ExplainCalculation = () => {
  const [formData, setFormData] = useState({
    predictedScore: "",
    totalCarbonTonnage: "",
  });
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResponse(null);

    try {
      const res = await fetch("http://localhost:8000/explain_calculation/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          predicted_score: parseFloat(formData.predictedScore),
          total_carbon_tonnage: parseFloat(formData.totalCarbonTonnage),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to calculate. Please check your input values.");
      }

      const data = await res.json();
      setResponse(data.explanation);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auction-form-container">
      <h4>Explain Carbon Credit Calculation</h4>
      <p className="info-text">Provide inputs to calculate and understand the carbon credit range.</p>

      <form className="auction-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="predictedScore">Predicted Score</label>
          <input
            type="number"
            name="predictedScore"
            id="predictedScore"
            className="form-input"
            value={formData.predictedScore}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="totalCarbonTonnage">Total Carbon Tonnage</label>
          <input
            type="number"
            name="totalCarbonTonnage"
            id="totalCarbonTonnage"
            className="form-input"
            value={formData.totalCarbonTonnage}
            onChange={handleInputChange}
            required
          />
        </div>

        {error && (
          <div className="error-text">
            <span>Error:</span> {error}
          </div>
        )}

        <button type="submit" className="submit-button" disabled={!formData.predictedScore || !formData.totalCarbonTonnage}>
          Calculate
        </button>
      </form>

      {response && (
        <div className="success-text">
          <h4>Calculation Explained:</h4>
          <p><strong>Input Values:</strong></p>
          <pre>{JSON.stringify(response.input_values, null, 2)}</pre>
          <p><strong>Calculated Values:</strong></p>
          <pre>{JSON.stringify(response.calculated_values, null, 2)}</pre>
          <p><strong>Steps:</strong></p>
          <ul>
            {response.explanation_steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ExplainCalculation;
