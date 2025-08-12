# Stock Price Predictor and Portfolio

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/React-18.2.0-blue?logo=react" alt="React">
  <img src="https://img.shields.io/badge/Node.js-20.x-green?logo=nodedotjs" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-4.19.2-lightgrey?logo=express" alt="Express.js">
  <img src="https://img.shields.io/badge/Python-3.10-blue?logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Flask-3.0.3-lightgrey?logo=flask" alt="Flask">
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-cyan?logo=tailwindcss" alt="Tailwind CSS">
</p>

An advanced, full-stack web application designed to provide AI-driven stock price predictions and comprehensive portfolio management. This tool features a modern, dark-themed UI built with React.js, a robust backend powered by Node.js/Express, and a dedicated Python/Flask service for sophisticated machine learning predictions.

---

### 🚀 Live Demo
(Link to Deployed App)

---

### ✨ Key Features

* **🔐 Secure User Authentication:** Robust login system with special administrative privileges.
* **🛡️ Admin Dashboard:** Exclusive admin view with a detailed audit log to monitor user prediction activities in real-time.
* **📈 Dynamic Market Dashboard:** Displays live (mocked) data for major indices (NIFTY, SENSEX, NASDAQ) and a scrolling financial news ticker.
* **🤖 AI-Powered Prediction Engine:**
    * Supports a wide range of tickers from US and Indian markets.
    * Flexible prediction timelines, from short-term (tomorrow) to long-term (1 year+).
    * Delivers a precise price target, a confidence score, and a projected market value range.
    * Features a dynamic indicator meter for at-a-glance sentiment analysis.
    * Conducts a comparative analysis against top industry peers on Valuation, Durability, and Momentum.
* **📊 Comprehensive Portfolio Management:**
    * A dedicated page for a detailed breakdown of stock holdings.
    * In-depth calculations for Market Cap, CIV, ROI, and daily Gain/Loss.
    * An interactive 3D donut chart for clear visualization of sector-wise investment allocation.

---

### 📸 Application Screenshots

<table>
  <tr>
    <td><img src="https://placehold.co/800x450/1a202c/718096?text=Login+Page" alt="Login Page"></td>
    <td><img src="https://placehold.co/800x450/1a202c/718096?text=Main+Dashboard" alt="Main Dashboard"></td>
  </tr>
  <tr>
    <td align="center"><em>Login Page</em></td>
    <td align="center"><em>Main Dashboard with Market Data</em></td>
  </tr>
  <tr>
    <td><img src="https://placehold.co/800x450/1a202c/718096?text=Prediction+Result" alt="Prediction Result"></td>
    <td><img src="https://placehold.co/800x450/1a202c/718096?text=Portfolio+Page" alt="Portfolio Page"></td>
  </tr>
  <tr>
    <td align="center"><em>AI Prediction with Peer Analysis</em></td>
    <td align="center"><em>Portfolio with 3D Sector Allocation Chart</em></td>
  </tr>
</table>

---

### 🛠️ Tech Stack

* **Frontend:** React.js, Tailwind CSS
* **Backend:** Node.js, Express.js
* **Machine Learning Service:** Python, Flask, Scikit-learn
* **Data:** YFinance

---

### ⚙️ Local Setup and Installation

To run this project locally, you will need Node.js, npm, and Python installed. The application requires three separate terminal sessions to run concurrently.

**1. Backend Setup**

```bash
# Terminal 1: Backend Server
# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Start the server
npm start
```

✅ The backend server will be running on `http://localhost:3001`.

**2. Machine Learning Service Setup**

```bash
# Terminal 2: ML Service
# Navigate to the ML service directory
cd ml-service

# (Recommended) Create and activate a Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\\Scripts\\activate`

# Install Python dependencies
pip install -r requirements.txt

# Start the Flask server
python app.py
```

✅ The ML service will be running on `http://localhost:5000`.

**3. Frontend Setup**

```bash
# Terminal 3: Frontend Client
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the React development server
npm start
```

✅ The React application will open in your browser at `http://localhost:3000`.

---

### 💡 How to Use

1.  Ensure all three services (backend, ml-service, frontend) are running.
2.  Open your browser to `http://localhost:3000`.
3.  **Login:**
    * **Admin Access:** Use `admin` / `aaron1234` to access the Audit Log.
    * **Standard User:** Log in with any other credentials (e.g., `user` / `password`).
4.  **Make a Prediction:** On the dashboard, enter a stock ticker, select a timeline, and click **Submit**.
5.  **View Portfolio:** Click the "Portfolio" button in the header to see your holdings.

---

### 🔮 Future Enhancements

* \[ ] **Real-time Data:** Integrate with a live market data API (e.g., Alpha Vantage, Finnhub).
* \[ ] **Persistent Database:** Replace the in-memory store with MongoDB or PostgreSQL for persistent user data.
* \[ ] **Advanced ML Models:** Implement more complex models like LSTMs or ARIMA for improved prediction accuracy.
* \[ ] **User-specific Portfolios:** Allow users to create and manage their own portfolios.
* \[ ] **Containerization:** Dockerize the application for easier deployment.

---

### 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
