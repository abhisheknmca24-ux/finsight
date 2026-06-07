# FinSight - AI-Powered Personal Finance Management System

## Project Overview

FinSight is a full-stack financial intelligence application with three main components:

- **Backend**: Express.js REST API with MongoDB, JWT authentication, CSV processing
- **Frontend**: React SPA with Vite, Recharts, React Router, Context API
- **ML Service**: FastAPI Python service with scikit-learn for categorization and prediction

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Backend | Node.js, Express 5.x, Mongoose, JWT, Multer, csv-parser |
| Frontend | React 18, Vite, React Router, Axios, Recharts |
| ML Service | Python 3.8+, FastAPI, scikit-learn, pandas, numpy |
| Database | MongoDB |

## Project Structure

```
finsight/
├── backend/                    # Express.js server
│   ├── config/db.js           # MongoDB connection
│   ├── controllers/           # Route handlers (auth, transaction, budget, etc.)
│   ├── middleware/            # Auth and error handling middleware
│   ├── models/                # Mongoose schemas (User, Transaction, Budget, Investment)
│   ├── routes/                # API endpoint definitions
│   ├── uploads/               # CSV file storage
│   ├── utils/                 # Helper functions (categorizer, dateNormalizer)
│   └── server.js              # Main entry point
│
├── frontend/                  # React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Route pages (Dashboard, AddTransaction, etc.)
│   │   ├── context/           # React Context for auth state
│   │   ├── services/          # API clients (api.js, authService.js)
│   │   └── App.jsx            # Main app component
│   └── vite.config.js         # Vite configuration
│
└── ml-service/                # Python ML service
    ├── main.py                # FastAPI app with endpoints
    ├── data/                  # Training datasets
    └── models/                # Trained model storage
```

## Coding Conventions

### Backend
- Use `const` for require statements, arrow functions for controllers
- Async/await with try/catch for error handling
- Mongoose validation with custom error messages
- Centralized error middleware in `middleware/errorMiddleware.js`
- Environment variables via `.env` files

### Frontend
- Functional components with hooks
- JSX files with `.jsx` extension
- Context API for global state (AuthContext)
- Axios for HTTP requests with centralized base URL
- Inline styles in components (no CSS modules)

### ML Service
- FastAPI with Pydantic models
- scikit-learn pipelines with TF-IDF vectorization
- Environment-agnostic (runs on port 8000)

## Key Patterns

1. **Authentication**: JWT stored in localStorage, verified via authMiddleware
2. **CRUD Operations**: Full create/read/update/delete for transactions and budgets
3. **File Upload**: Multer handles CSV uploads, csv-parser processes data
4. **ML Integration**: Backend calls ML service endpoints for categorization and predictions
5. **Error Handling**: Consistent JSON error responses with status codes

## Commands

- **Backend**: `cd backend && npm run dev` (nodemon) or `npm start`
- **Frontend**: `cd frontend && npm run dev`
- **ML Service**: `cd ml-service && uvicorn main:app --reload --port 8000`
- **Install all**: Run install commands in each directory separately

## API Endpoints

Key routes under `/api/`:
- `/auth/*` - Register, login
- `/transactions` - CRUD operations
- `/budget` - CRUD operations  
- `/dashboard` - Aggregated data
- `/predict` - ML predictions
- `/score` - Financial health score
- `/recommendations` - Smart suggestions
- `/upload` - CSV import

## Environment Variables

Backend `.env` required:
```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/finghit
JWT_SECRET=your_secret_key
ML_SERVICE_URL=http://127.0.0.1:8000
```

Frontend optional `.env` for API base URL.

## Notes for OpenCode

- This is a full-stack JavaScript + Python project
- Backend uses CommonJS modules (`require`)
- Frontend uses ES modules (`import`)
- ML service is independent FastAPI app
- MongoDB required for backend functionality
- CSV files in root are sample data files