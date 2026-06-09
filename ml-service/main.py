from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import numpy as np
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

texts = [
    "swiggy", "zomato", "food", "restaurant", "dinner", "lunch", "breakfast",
    "cafe", "coffee", "snacks", "pizza", "burger", "groceries", "meal",
    "uber", "ola", "cab", "taxi", "auto", "metro", "bus", "train",
    "flight", "travel", "commute", "parking", "fuel", "petrol",
    "amazon", "flipkart", "shopping", "clothes", "shoes", "electronics",
    "gadget", "accessories", "gift", "online", "mall", "store",
    "movie", "cinema", "concert", "game", "gaming", "netflix", "spotify",
    "music", "sports", "event",
    "electricity", "water", "gas", "internet", "mobile", "phone", "bill",
    "broadband", "recharge",
    "rent", "house", "apartment", "flat", "lease",
    "medical", "doctor", "hospital", "pharmacy", "medicine", "health",
    "gym", "fitness", "dental",
    "sip", "mutual", "stock", "bond", "gold", "investment", "fund",
]

labels = [
    "food", "food", "food", "food", "food", "food", "food",
    "food", "food", "food", "food", "food", "groceries", "food",
    "transport", "transport", "transport", "transport", "transport", "transport",
    "transport", "transport", "transport", "transport", "transport", "transport",
    "transport", "transport", "transport",
    "shopping", "shopping", "shopping", "shopping", "shopping", "shopping",
    "shopping", "shopping", "shopping", "shopping", "shopping", "shopping",
    "entertainment", "entertainment", "entertainment", "entertainment", "entertainment",
    "entertainment", "entertainment", "entertainment", "entertainment", "entertainment", "entertainment",
    "utilities", "utilities", "utilities", "utilities", "utilities", "utilities", "utilities",
    "utilities", "utilities",
    "rent", "rent", "rent", "rent", "rent",
    "health", "health", "health", "health", "health", "health",
    "health", "health", "health",
    "investment", "investment", "investment", "investment", "investment", "investment", "investment",
]

vectorizer = TfidfVectorizer()
X = vectorizer.fit_transform(texts)

model = MultinomialNB()
model.fit(X, labels)

class CategorizeRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)

@app.post("/categorize")
def categorize(item: CategorizeRequest):
    try:
        vec = vectorizer.transform([item.description.lower()])
        category = model.predict(vec)[0]
        return {"category": category}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PredictRequest(BaseModel):
    values: list[float] = Field(..., min_length=1)

class PredictionRequest(BaseModel):
    values: list[float] = Field(..., min_length=1)
    income: float = Field(0, ge=0)

@app.post("/predict")
def predict(expense: PredictRequest):
    try:
        values = expense.values
        X = np.array(range(len(values))).reshape(-1, 1)
        y = np.array(values, dtype=float)

        lr = LinearRegression()
        lr.fit(X, y)
        pred_lr = lr.predict([[len(values)]])[0]
        score_lr = lr.score(X, y)

        try:
            rf = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
            rf.fit(X, y)
            pred_rf = rf.predict([[len(values)]])[0]
            score_rf = rf.score(X, y)

            if score_rf > score_lr:
                pred = pred_rf * 0.6 + pred_lr * 0.4
            else:
                pred = pred_lr * 0.6 + pred_rf * 0.4
            avg_score = (score_lr + score_rf) / 2
            model_components = {
                "linear_regression": float(pred_lr),
                "random_forest": float(pred_rf),
            }
        except Exception:
            pred = pred_lr
            avg_score = score_lr
            model_components = {
                "linear_regression": float(pred_lr),
            }

        confidence = "high" if avg_score > 0.75 else "medium" if avg_score > 0.5 else "low"

        trend = "increasing" if lr.coef_[0][0] > 0 else "decreasing"

        volatility = float(np.std(y))
        average_expense = float(np.mean(y))

        return {
            "prediction": float(max(0, pred)),
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
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict-yearend")
def predict_yearend(req: PredictionRequest):
    try:
        values = req.values
        X = np.array(range(len(values))).reshape(-1, 1)
        y = np.array(values, dtype=float)

        lr = LinearRegression()
        lr.fit(X, y)
        lr_score = lr.score(X, y)

        try:
            rf = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10)
            rf.fit(X, y)
            rf_score = rf.score(X, y)
        except Exception:
            rf_score = lr_score

        def ensemble_predict(index):
            pred_lr = float(lr.predict([[index]])[0])
            if rf_score > lr_score:
                pred_rf = float(rf.predict([[index]])[0])
                return max(0.0, pred_rf * 0.6 + pred_lr * 0.4), pred_lr, pred_rf
            return max(0.0, pred_lr), pred_lr, pred_lr

        today = datetime.now()
        months_remaining = 12 - int(today.month)

        future_expenses = []
        model_components_by_month = []
        for i in range(len(values) + 1, len(values) + months_remaining + 1):
            pred_exp, pred_lr, pred_rf = ensemble_predict(i)
            future_expenses.append(pred_exp)
            model_components_by_month.append({
                "linear_regression": pred_lr,
                "random_forest": pred_rf,
                "ensemble": pred_exp,
            })

        next_month_pred, next_lr, next_rf = ensemble_predict(len(values))
        total_projected_expenses = sum(future_expenses) + next_month_pred
        total_projected_income = req.income * (months_remaining + 1)
        year_end_savings = total_projected_income - total_projected_expenses

        monthly_avg_expense = np.mean(future_expenses) if future_expenses else next_month_pred
        monthly_avg_savings = req.income - monthly_avg_expense

        combined_score = (lr_score + rf_score) / 2
        confidence = "high" if combined_score > 0.75 and len(values) >= 6 else "medium" if len(values) >= 3 else "low"

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
            "nextMonthComponents": {
                "linear_regression": float(next_lr),
                "random_forest": float(next_rf),
                "ensemble": float(next_month_pred),
            },
            "futureMonthComponents": model_components_by_month,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def root():
    return {"message": "Financial ML Service is running", "version": "2.0"}

@app.get("/health")
def health():
    return {"status": "healthy", "models": ["categorization", "prediction"]}
