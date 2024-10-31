// CoordinatesContext.js
import { createContext, useContext, useState } from "react";

const CoordinatesContext = createContext();

export const useCoordinates = () => useContext(CoordinatesContext);

export const CoordinatesProvider = ({ children }) => {
  const [coordinatesFilled, setCoordinatesFilled] = useState(false);

  return (
    <CoordinatesContext.Provider value={{ coordinatesFilled, setCoordinatesFilled }}>
      {children}
    </CoordinatesContext.Provider>
  );
};
