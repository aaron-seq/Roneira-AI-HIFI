Stock Prediction & Portfolio Management ToolAn advanced, full-stack web application designed to provide AI-driven stock price predictions and comprehensive portfolio management. This tool features a modern, dark-themed UI built with React.js, a robust backend powered by Node.js/Express, and a dedicated Python/Flask service for sophisticated machine learning predictions.Live Demo (Link to Deployed App)Screenshots<p align="center"><img src="https://placehold.co/800x450/1a202c/718096?text=Login+Page" alt="Login Page" style="width:48%; margin: 1%; border-radius: 8px; box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);"><img src="https://placehold.co/800x450/1a202c/718096?text=Main+Dashboard" alt="Main Dashboard" style="width:48%; margin: 1%; border-radius: 8px; box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);"><img src="https://placehold.co/800x450/1a202c/718096?text=Prediction+Result" alt="Prediction Result" style="width:48%; margin: 1%; border-radius: 8px; box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);"><img src="https://placehold.co/800x450/1a202c/718096?text=Portfolio+View" alt="Portfolio View" style="width:48%; margin: 1%; border-radius: 8px; box-shadow: 0 4px 8px 0 rgba(0,0,0,0.2);"></p>Core FeaturesSecure User Authentication: A robust login system with special administrative privileges.Admin Dashboard: Exclusive admin view with a detailed audit log to monitor all user prediction activities in real-time.Dynamic Market Dashboard: Displays live (mocked) data for major indices (NIFTY, SENSEX, NASDAQ, etc.) and a scrolling financial news ticker.AI-Powered Prediction Engine:Supports a wide range of tickers from US and Indian markets.Flexible prediction timelines, from short-term (tomorrow) to long-term (1 year+).Delivers a precise price target, a confidence score, and a projected market value range.Features a dynamic indicator meter for at-a-glance sentiment analysis (Strong Buy, Buy, Hold, Sell, Strong Sell).Conducts a comparative analysis against the top 4 industry peers based on Valuation, Durability, and Momentum.Comprehensive Portfolio Management:A dedicated page for a detailed breakdown of stock holdings.In-depth calculations for Market Cap, Average Buy Price, Current Investment Value (CIV), Return on Investment (ROI), and daily Gain/Loss.An interactive 3D donut chart for clear visualization of sector-wise investment allocation.Tech Stack & ArchitectureThis application uses a microservice-oriented architecture to ensure separation of concerns and scalability.ComponentTechnologyDescriptionFrontend (Client)React.js, Tailwind CSS, Recharts, Lucide-ReactA dynamic and responsive user interface that provides all the data visualization and user interaction.Backend (Gateway)Node.js, Express.jsHandles user authentication, manages audit logs, and acts as a secure gateway between the client and the ML service.ML ServicePython, Flask, NumpyA dedicated service that encapsulates the machine learning model, handling the complex task of stock prediction.DatabaseIn-Memory (Mocked)Currently uses in-memory storage for users and logs. Designed for easy integration with MongoDB or PostgreSQL.Architectural Overview[ User on Browser ]
       |
       v
[ React Frontend (localhost:3000) ]
       | (REST API Calls)
       v
[ Node.js Backend (localhost:3001) ]
   - Handles Auth & Logging
   - Forwards prediction requests
       | (Internal API Call)
       v
[ Python ML Service (localhost:5000) ]
   - Runs prediction model
   - Returns analysis
Setup and InstallationTo run this project locally, you will need Node.js, npm, and Python installed. The application requires three separate terminal sessions to run concurrently.1. Backend Setup# Navigate to the backend directory
cd backend

# Install dependencies
npm install

# Start the server
npm start
The backend server will run on http://localhost:3001.2. Machine Learning Service Setup# Navigate to the ML service directory
cd ml-service

# (Recommended) Create and activate a Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

# Install Python dependencies
pip install -r requirements.txt

# Start the Flask server
python app.py
The ML service will run on http://localhost:5000.3. Frontend Setup# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the React development server
npm start
The React application will open in your browser at http://localhost:3000.How to UseEnsure all three services (backend, ml-service, frontend) are running.Open your browser to http://localhost:3000.Login:Admin Access: Use admin / aaron1234 to access the Audit Log.Standard User: Log in with any other credentials (e.g., user / password).Make a Prediction: On the dashboard, enter a stock ticker, select a timeline, and click Submit.View Portfolio: Click the "Portfolio" button in the header to see your holdings.Future Enhancements[ ] Real-time Data: Integrate with a live market data API (e.g., Alpha Vantage, Finnhub).[ ] Persistent Database: Replace the in-memory store with MongoDB or PostgreSQL for persistent user data.[ ] Advanced ML Models: Implement more complex models like LSTMs or Transformer networks for higher prediction accuracy.[ ] User Customization: Allow users to customize their dashboard and create multiple watchlists.[ ] Containerization: Dockerize the entire application for easier deployment and scalability.ContributingContributions are welcome! If you'd like to contribute, please fork the repository and create a pull request. You can also open an issue with the "enhancement" tag.Fork the ProjectCreate your Feature Branch (git checkout -b feature/AmazingFeature)Commit your Changes (git commit -m 'Add some AmazingFeature')Push to the Branch (git push origin feature/AmazingFeature)Open a Pull RequestLicenseThis project is licensed under the MIT License. See the LICENSE file for more details.
