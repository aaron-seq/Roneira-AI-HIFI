import React from "react";
import ReactDOM from "react-dom/client";
import App from "./features/Shell/App.tsx";
import "./styles/index.css";

// Create React root and render the application
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
