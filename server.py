from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/rates")
async def get_exchange_rates():
    try:
        # Получаем курсы от ЦБ РФ
        cbr_response = requests.get("https://www.cbr-xml-daily.ru/daily_json.js")
        cbr_data = cbr_response.json()
        
        rates = {
            "USD": cbr_data["Valute"]["USD"]["Value"],
            "JPY": cbr_data["Valute"]["JPY"]["Value"] / cbr_data["Valute"]["JPY"]["Nominal"],
            "CNY": cbr_data["Valute"]["CNY"]["Value"] / cbr_data["Valute"]["CNY"]["Nominal"],
            "KRW": cbr_data["Valute"]["KRW"]["Value"] / cbr_data["Valute"]["KRW"]["Nominal"] if "KRW" in cbr_data["Valute"] else 0.067,
            "updated": datetime.now().isoformat()
        }
        
        return rates
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/shipping/{country}")
async def get_shipping_rates(country: str):
    # Здесь можно подключить реальные API логистических компаний
    shipping_rates = {
        "JP": {"vladivostok": 800, "novorossiysk": 1500, "spb": 1800},
        "CN": {"vladivostok": 500, "novorossiysk": 1200, "spb": 1500},
        "KR": {"vladivostok": 400, "novorossiysk": 1100, "spb": 1400}
    }
    
    return shipping_rates.get(country, {})
