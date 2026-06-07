# Finghit - Troubleshooting Guide

## Issues Fixed

### 1. **Financial Health Score & Expense Predictions Not Displaying**

#### Problem
The financial health score and prediction data were not showing on the prediction page. The metrics cards showed empty values instead of actual numbers.

#### Root Cause
The backend `/api/score` endpoint was returning metrics nested under a `metrics` object:
```javascript
// OLD - Backend Response Structure
{
  healthScore: 90,
  metrics: {
    income: 50000,
    expense: 20000,
    ...
  }
}
```

But the frontend component `Prediction.jsx` was trying to access these properties directly:
```javascript
// Frontend Expected Access
score.income  // ❌ Won't work - should be score.metrics.income
score.expense // ❌ Won't work
```

#### Solution Applied
✅ **Fixed scoreController.js** - Flattened the response structure to match frontend expectations:
```javascript
// NEW - Flattened Response Structure
res.json({
  healthScore: Math.round(totalScore),
  status,
  statusColor,
  // Metrics now at top level
  income: parseFloat(income.toFixed(2)),
  expense: parseFloat(expense.toFixed(2)),
  savings: parseFloat(savings.toFixed(2)),
  savingsRatio: parseFloat(savingsRatio.toFixed(2)),
  expenseRatio: parseFloat(expenseRatio.toFixed(2)),
  avgMonthlyExpense: parseFloat((expense / Math.max(1, monthlyExpenseValues.length)).toFixed(2)),
  predictedExpense: parseFloat(predictedExpense.toFixed(2)),
  // ... other properties
})
```

### 2. **Prediction Route Method Mismatch**

#### Problem
The prediction route was using GET method but the controller expected POST request.

#### Root Cause
In `predictionRoutes.js`, the route was defined as:
```javascript
router.get("/", auth, predictExpense); // ❌ GET
```

But the `predictExpense` controller expects to receive expense values to send to the ML service, which should be a POST request.

#### Solution Applied
✅ **Fixed predictionRoutes.js** - Changed to POST method:
```javascript
router.post("/", auth, predictExpense); // ✅ POST
```

### 3. **ML Service Requirements Not Documented**

#### Problem
The `ml-service/requirements.txt` file was empty, making it unclear what Python packages need to be installed.

#### Solution Applied
✅ **Created ml-service/requirements.txt** with all necessary packages:
```
fastapi==0.104.1
uvicorn==0.24.0
scikit-learn==1.3.2
pandas==2.1.3
numpy==1.26.2
pydantic==2.5.0
python-multipart==0.0.6
```

---

## Verification Steps

Follow these steps to verify everything is working:

### Step 1: Verify Backend Changes
```bash
cd backend
```

Check that `scoreController.js` returns flattened metrics:
- Confirm metrics are at the top level of the response
- Ensure predictedExpense value is included

### Step 2: Setup ML Service
```bash
cd ml-service

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start ML service
uvicorn main:app --reload --port 8000
```

### Step 3: Verify Backend Connection
```bash
cd backend

# Make sure MongoDB is running
# Create .env file if not exists:
# PORT=5000
# MONGODB_URI=mongodb://localhost:27017/finghit
# JWT_SECRET=your_secret_key

npm install
npm run dev
```

The backend should start on `http://localhost:5000`

### Step 4: Test Frontend
```bash
cd frontend
npm install
npm run dev
```

The frontend will be at `http://localhost:5173`

### Step 5: Verify Financial Score Display
1. Login to the application
2. Navigate to **Prediction** page
3. You should now see:
   - ✅ Financial Health Score (0-100)
   - ✅ Income, Expense, Savings metrics
   - ✅ Savings Ratio and Expense Ratio percentages
   - ✅ Average Monthly Expense
   - ✅ Predicted Next Month Expense
   - ✅ Monthly Savings Potential

---

## Common Issues & Solutions

### Issue: Still showing empty values
**Solution:**
- Ensure you have transactions in the database
- Check browser console for API errors
- Verify MongoDB is running and connected
- Check backend logs for any errors

### Issue: "No transactions found"
**Solution:**
- Upload some financial data through the Upload page
- Or create transactions manually through the Add Transaction page
- The system needs at least one transaction to calculate metrics

### Issue: ML Service not responding
**Solution:**
```bash
# Check if ML service is running on port 8000
curl http://localhost:8000/docs

# Verify Python virtual environment has all packages
pip list | grep fastapi
```

### Issue: 401 Unauthorized errors
**Solution:**
- Make sure you're logged in
- Check that JWT token is being stored in localStorage
- Verify `.env` JWT_SECRET is set

### Issue: Port already in use
**Solution:**
Windows:
```powershell
netstat -ano | findstr :5000  # Find process using port 5000
taskkill /PID <PID> /F        # Kill the process
```

macOS/Linux:
```bash
lsof -i :5000           # Find process
kill -9 <PID>          # Kill the process
```

---

## Expected API Response Format

### `/api/score` Endpoint (GET)
```json
{
  "healthScore": 90,
  "status": "Good",
  "statusColor": "green",
  "income": 50000.00,
  "expense": 15000.00,
  "savings": 35000.00,
  "savingsRatio": 70.00,
  "expenseRatio": 30.00,
  "avgMonthlyExpense": 5000.00,
  "predictedExpense": 4800.00,
  "investmentAmount": 2000.00,
  "investmentRatio": 4.00,
  "transactionCount": 45,
  "scoreBreakdown": {
    "savingsRatio": {
      "value": 25,
      "max": 25,
      "percentage": 100
    }
    // ... other factors
  },
  "categoryBreakdown": {
    "food": 3000,
    "transport": 1500,
    "utilities": 500
  },
  "budgetAnalysis": [
    {
      "category": "food",
      "limit": 4000,
      "spent": 3000,
      "percentage": 75
    }
    // ... other budgets
  ]
}
```

---

## Files Modified

1. **`backend/controllers/scoreController.js`**
   - Flattened response metrics structure

2. **`backend/routes/predictionRoutes.js`**
   - Changed route method from GET to POST

3. **`ml-service/requirements.txt`**
   - Added all required Python packages

---

## Next Steps

1. ✅ Apply all the fixes mentioned above
2. ✅ Restart all services (backend, frontend, ML service)
3. ✅ Create test data by uploading a CSV or adding transactions
4. ✅ Navigate to Prediction page and verify scores display
5. ✅ Check browser console for any errors
6. ✅ Check backend logs for any issues

---

## Support

If issues persist after applying these fixes:

1. Check that all services are running:
   - Backend on `http://localhost:5000`
   - Frontend on `http://localhost:5173`
   - ML Service on `http://localhost:8000`

2. Verify MongoDB is running

3. Check browser DevTools (F12) → Network tab for API errors

4. Check terminal logs for backend errors

5. Ensure `.env` file exists in backend folder with proper configuration

