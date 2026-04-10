# FinSight - Smart Expense Tracking and Financial Health Prediction

FinSight is a full-stack personal finance platform with AI-assisted insights.
It supports:

- Web app (React + Vite)
- REST backend (Node.js + Express + MongoDB)
- ML service (FastAPI + scikit-learn)
- Android app packaging via Capacitor

## Live Links

Use this section as the single source of truth for public links.

| Service | URL | Notes |
| --- | --- | --- |
| Frontend (Web) | https://finsight-wheat.vercel.app | Vercel deployment |
| Backend API (Public) | https://finsight-faew.onrender.com | Used as frontend fallback in src/services/api.js |
| Backend Health | https://finsight-faew.onrender.com/api/test | Should return status ok |
| MongoDB (Atlas) | mongodb+srv://<username>:<password>@<cluster-host>/finghit?retryWrites=true&w=majority | Use in backend/.env as MONGO_URI |

## Local Development URLs

| Service | Local URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend | http://localhost:5000 |
| ML Service | http://localhost:8000 |
| ML Swagger Docs | http://localhost:8000/docs |

## Project Goals

- Track income, expenses, and investments
- Import statement files (CSV and PDF)
- Auto-categorize transactions
- Compute budget, savings, and health score
- Generate AI predictions and recommendations
- Export professional PDF reports
- Run same UI in web and Android app (Capacitor)

## Tech Stack

### Frontend

- React 18
- Vite 5
- React Router
- Axios
- Recharts
- Custom CSS system (not Tailwind)
- Capacitor (Android packaging)

### Backend

- Node.js + Express 5
- MongoDB + Mongoose
- JWT auth
- Multer + csv-parser (file import)
- PDF utilities (pdf-parse, pdfjs-dist, tesseract.js)
- PDF report generation (pdfkit)

### ML Service

- FastAPI
- scikit-learn
- pandas
- numpy

## Repository Structure

```
finsight-main/
├── backend/                 # Express API + MongoDB logic
│   ├── controllers/         # Route handlers
│   ├── middleware/          # Auth and error handling
│   ├── models/              # Mongoose schemas
│   ├── routes/              # API route declarations
│   ├── utils/               # Parsing, normalization, helpers
│   └── server.js            # API entry point
│
├── frontend/                # React + Vite client
│   ├── src/components/      # Sidebar, shared UI
│   ├── src/pages/           # Dashboard, Budget, Upload, Prediction...
│   ├── src/services/        # Axios client and auth service
│   ├── capacitor.config.json
│   └── android/             # Native Android project (after cap add)
│
├── ml-service/              # FastAPI ML endpoints
│   ├── main.py
│   └── requirements.txt
│
├── TROUBLESHOOTING.md
└── README.md
```

## End-to-End Flow (How Everything Works)

### 1) Authentication Flow

1. User registers/logs in from frontend.
2. Frontend sends credentials to backend auth endpoints.
3. Backend validates, signs JWT, and returns token.
4. Frontend stores token in localStorage.
5. Axios interceptor attaches Authorization header to protected API calls.

### 2) Transaction Flow

1. User adds transaction manually or via upload.
2. Backend validates payload.
3. Data is stored in MongoDB.
4. Dashboard, budgets, and predictions read from the same transaction source.

### 3) Upload Flow (CSV/PDF)

1. User uploads statement in Upload page.
2. Backend parses CSV/PDF, normalizes dates and amounts.
3. Categorization helpers infer transaction categories.
4. Valid transactions are inserted; duplicates/errors tracked.
5. Frontend shows import summary and statistics.

### 4) Prediction Flow

1. Backend aggregates monthly expense series per user.
2. Backend calls ML service through ML_SERVICE_URL.
3. ML service returns forecast outputs.
4. Backend combines AI response with app metrics.
5. Frontend renders score, trend cards, and category forecasts.

### 5) Report Generation Flow

1. Frontend requests report endpoint.
2. Backend builds charts and summary tables.
3. Backend streams PDF response.
4. Frontend downloads report file.

### 6) Mobile (Capacitor) Flow

1. Build frontend to dist.
2. Copy dist into android/app/src/main/assets/public.
3. Open Android Studio project.
4. Run/debug as native Android app shell.

## API Overview

Base URL (local): http://localhost:5000/api

Key route groups:

- /auth -> registration/login
- /transactions -> CRUD + rule-based categorization utilities
- /dashboard -> summary cards + charts data
- /budget -> budget and allocation logic
- /score -> health score metrics
- /recommendations -> AI tips
- /predict -> forecasting endpoints
- /report -> PDF generation
- /upload -> CSV/PDF import and reset utilities
- /loan -> EMI/loan analysis endpoints

Health checks:

- GET / -> API running text
- GET /api/test -> JSON status response

## Prerequisites

- Node.js 18+ (recommended)
- npm 9+
- Python 3.8+
- MongoDB Atlas (or local MongoDB)
- Android Studio (for mobile build)

## Environment Configuration

### Backend (backend/.env)

Create backend/.env with:

```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-host>/finghit?retryWrites=true&w=majority
JWT_SECRET=your_strong_secret
ML_SERVICE_URL=http://127.0.0.1:8000
```

Important:

- Never commit real secrets.
- Rotate any leaked credentials immediately.

### Frontend (frontend/.env optional)

Create frontend/.env for local backend usage:

```env
VITE_API_URL=http://localhost:5000
```

If not set, frontend fallback is the deployed backend URL.

## Run Locally (Complete Setup)

Open separate terminals.

### 1) Backend

```bash
cd backend
npm install
npm run dev
```

Expected: Server running on port 5000 and MongoDB connected.

### 2) ML Service

```bash
cd ml-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Expected: FastAPI running at port 8000.

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Expected: Vite app at http://localhost:5173.

## Run as Android App (Capacitor)

Run from frontend directory:

```bash
cd frontend
npm install
npm run build
npx cap copy android
npx cap open android
```

First-time Android setup only:

```bash
cd frontend
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init FinSight com.finsight.app --web-dir=dist
npx cap add android
```

After every frontend change:

```bash
cd frontend
npm run build
npx cap copy android
```

## Deployment Guide (High Level)

### Frontend -> Vercel

- Root: frontend
- Build command: npm run build
- Output directory: dist
- Environment variable: VITE_API_URL=<your-backend-url>

### Backend -> Render

- Root: backend
- Start command: npm start
- Add backend .env values in Render dashboard
- Ensure CORS and frontend URL are aligned

### ML Service -> Render/Railway/VM

- Deploy ml-service as a Python web service
- Set backend ML_SERVICE_URL to deployed ML URL

## Validation Checklist

After setup/deploy, verify:

1. Backend health endpoint returns status ok.
2. Login/register works and token is stored.
3. Add transaction updates dashboard totals.
4. CSV/PDF upload imports rows correctly.
5. Prediction and recommendation pages load.
6. Report download returns valid PDF.
7. Android app reflects latest build after cap copy.

## Troubleshooting

### Capacitor command fails at repository root

Symptom:

- npx cap add android -> could not determine executable to run

Fix:

- Run Capacitor commands from frontend folder where capacitor.config.json exists.

### Backend crashes with missing module errors

Fix:

```bash
cd backend
npm install
```

### Frontend cannot call backend

Fix:

- Check VITE_API_URL
- Confirm backend is running on port 5000
- Check browser/app network tab for CORS and 401 errors

### ML predictions fail

Fix:

- Ensure ml-service is running on port 8000
- Verify ML_SERVICE_URL in backend .env

## Security Notes

- Do not store real credentials in repository.
- Use strong JWT secrets in production.
- Restrict MongoDB IP allowlist in production.
- Validate uploaded file sizes/types at both client and server levels.

## Author

Abhishek N

## License

Add your preferred license here (for example: MIT).
