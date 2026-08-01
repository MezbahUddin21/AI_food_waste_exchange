from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import spoilage, ranking, forecast

app = FastAPI(
    title="Food Waste Exchange — ML Service",
    description="Spoilage prediction, NGO ranking, demand forecasting",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # only the backend calls this; tighten in prod if desired
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(spoilage.router)
app.include_router(ranking.router)
app.include_router(forecast.router)


@app.get("/health")
def health():
    return {"status": "ok"}
