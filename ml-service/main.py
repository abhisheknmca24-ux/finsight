from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import numpy as np
from datetime import datetime

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== Enhanced Categorization Model with More Training Data =====
texts = [
    # Food
    "swiggy", "zomato", "food", "restaurant", "dinner", "lunch", "breakfast",
    "cafe", "coffee", "snacks", "pizza", "burger", "groceries", "meal",
    # Travel/Transport
    "uber", "ola", "cab", "taxi", "auto", "metro", "bus", "train", "ticket",
    "flight", "travel", "commute", "parking", "fuel", "petrol",
    # Shopping
    "amazon", "flipkart", "shopping", "clothes", "shoes", "electronics",
    "gadget", "accessories", "gift", "online", "mall", "store",
    # Entertainment
    "movie", "cinema", "concert", "game", "gaming", "netflix", "spotify",
    "music", "sports", "event", "ticket",
    # Utilities
    "electricity", "water", "gas", "internet", "mobile", "phone", "bill",
    "broadband", "recharge",
    # Rent
    "rent", "house", "apartment", "flat", "lease",
    # Health
    "medical", "doctor", "hospital", "pharmacy", "medicine", "health",
    "gym", "fitness", "dental",
    # Investment
    "sip", "mutual", "stock", "bond", "gold", "investment", "fund",
]

labels = [
    # Food
    "food", "food", "food", "food", "food", "food", "food",
    "food", "food", "food", "food", "food", "groceries", "food",
    # Travel/Transport
    "transport", "transport", "transport", "transport", "transport", "transport",
    "transport", "transport", "transport", "transport", "transport", "transport",
    "transport", "transport", "transport",
    # Shopping
    "shopping", "shopping", "shopping", "shopping", "shopping", "shopping",
    "shopping", "shopping", "shopping", "shopping", "shopping", "shopping",
    # Entertainment
    "entertainment", "entertainment", "entertainment", "entertainment", "entertainment",
    "entertainment", "entertainment", "entertainment", "entertainment", "entertainment", "entertainment",
    # Utilities
    "utilities", "utilities", "utilities", "utilities", "utilities", "utilities", "utilities",
    "utilities", "utilities",
    # Rent
    "rent", "rent", "rent", "rent", "rent",
    # Health
    "health", "health", "health", "health", "health", "health",
    "health", "health", "health",
    # Investment
    "investment", "investment", "investment", "investment", "investment", "investment", "investment",
]

vectorizer = TfidfVectorizer()
X = vectorizer.fit_transform(texts)

model = MultinomialNB()
model.fit(X, labels)

class Item(BaseModel):
    description: str

@app.post("/categorize")
def categorize(item: Item):
    try:
        vec = vectorizer.transform([item.description.lower()])
        category = model.predict(vec)[0]
        return {"category": category}
    except Exception as e:
        return {"category": "other", "error": str(e)}


# ===== Enhanced Prediction Model =====
class Expense(BaseModel):
    values: list

class PredictionRequest(BaseModel):
    values: list
    income: float = 0

@app.post("/predict")
def predict(expense: Expense):
    """
    Predict next month expense using ensemble of Linear Regression and Random Forest
    """
    try:
        if not expense.values or len(expense.values) == 0:
            return {"prediction": 0, "confidence": "low", "modelUsed": "none"}

        X = np.array(range(len(expense.values))).reshape(-1, 1)
        y = np.array(expense.values, dtype=float)

        # Linear Regression
        lr = LinearRegression()
        lr.fit(X, y)
        pred_lr = lr.predict([[len(expense.values)]])[0]
        score_lr = lr.score(X, y)

        # Random Forest (better at handling non-linear patterns)
        try:
            rf = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
            rf.fit(X, y)
            pred_rf = rf.predict([[len(expense.values)]])[0]
            score_rf = rf.score(X, y)
            
            # Ensemble: weighted average (give more weight to better performing model)
            if score_rf > score_lr:
                pred = pred_rf * 0.6 + pred_lr * 0.4
            else:
                pred = pred_lr * 0.6 + pred_rf * 0.4
            avg_score = (score_lr + score_rf) / 2
            model_components = {
                "linear_regression": float(pred_lr),
                "random_forest": float(pred_rf),
            }
        except:
            pred = pred_lr
            avg_score = score_lr
            model_components = {
                "linear_regression": float(pred_lr),
            }

        # Determine confidence
        confidence = "high" if avg_score > 0.75 else "medium" if avg_score > 0.5 else "low"
        
        # Calculate trend
        trend = "increasing" if lr.coef_[0] > 0 else "decreasing"
        
        # Calculate volatility (standard deviation)
        volatility = float(np.std(y))
        average_expense = float(np.mean(y))

        return {
            "prediction": float(max(0, pred)),  # Ensure non-negative
            "confidence": confidence,
            "trend": trend,
            "r_squared": float(avg_score),
            "model": "ensemble_lr_rf",
            "model_components": model_components,
            "average_expense": float(average_expense),
            "volatility": float(volatility),
            "min_expense": float(np.min(y)),
            "max_expense": float(np.max(y))
        }
    except Exception as e:
        return {"prediction": 0, "confidence": "low", "error": str(e), "model": "error"}

@app.post("/predict-yearend")
def predict_yearend(req: PredictionRequest):
    """
    Predict year-end savings projection based on historical expenses and income
    """
    try:
        if not req.values or len(req.values) == 0:
            return {"yearEndSavings": 0, "monthsToProject": 0}

        X = np.array(range(len(req.values))).reshape(-1, 1)
        y = np.array(req.values, dtype=float)

        lr = LinearRegression()
        lr.fit(X, y)
        lr_score = lr.score(X, y)

        rf = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
        rf.fit(X, y)
        rf_score = rf.score(X, y)

        def ensemble_predict(index):
            pred_lr = float(lr.predict([[index]])[0])
            pred_rf = float(rf.predict([[index]])[0])
            if rf_score > lr_score:
                return max(0.0, pred_rf * 0.6 + pred_lr * 0.4), pred_lr, pred_rf
            return max(0.0, pred_lr * 0.6 + pred_rf * 0.4), pred_lr, pred_rf

        today = datetime.now()
        months_passed = int(today.month)
        months_remaining = 12 - months_passed
        
        future_expenses = []
        model_components_by_month = []
        for i in range(len(req.values), len(req.values) + months_remaining):
            pred_exp, pred_lr, pred_rf = ensemble_predict(i)
            future_expenses.append(pred_exp)
            model_components_by_month.append({
                "linear_regression": pred_lr,
                "random_forest": pred_rf,
                "ensemble": pred_exp,
            })

        next_month_pred, next_lr, next_rf = ensemble_predict(len(req.values))
        total_projected_expenses = sum(future_expenses) + next_month_pred
        total_projected_income = req.income * (months_remaining + 1)  # Include current month
        year_end_savings = total_projected_income - total_projected_expenses

        monthly_avg_expense = np.mean(future_expenses) if future_expenses else next_month_pred
        monthly_avg_savings = req.income - monthly_avg_expense

        combined_score = (lr_score + rf_score) / 2
        confidence = "high" if combined_score > 0.75 and len(req.values) >= 6 else "medium" if len(req.values) >= 3 else "low"

        return {
            "yearEndSavings": float(max(0, year_end_savings)),
            "monthsToProject": months_remaining + 1,
            "totalProjectedIncome": float(total_projected_income),
            "totalProjectedExpenses": float(total_projected_expenses),
            "monthlyAverageSavings": float(max(0, monthly_avg_savings)),
            "monthlyAverageExpense": float(monthly_avg_expense),
            "nextMonthExpense": float(next_month_pred),
            "confidence": confidence,
            "model": "ensemble_lr_rf",
            "r_squared": float(combined_score),
            "next_month_components": {
                "linear_regression": float(next_lr),
                "random_forest": float(next_rf),
                "ensemble": float(next_month_pred),
            },
            "future_month_components": model_components_by_month,
        }
    except Exception as e:
        return {"yearEndSavings": 0, "monthsToProject": 0, "error": str(e)}

@app.get("/")
def root():
    return {"message": "Financial ML Service is running", "version": "2.0"}

@app.get("/health")
def health():
    return {"status": "healthy", "models": ["categorization", "prediction"]}
