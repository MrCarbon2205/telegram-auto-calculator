from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests
import json
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

app = FastAPI(
    title="AutoImport Calculator API",
    description="API для расчета стоимости авто с доставкой",
    version="1.0.0"
)

# Настройка CORS для конкретных доменов
origins = [
    "https://mrcarbon2205.github.io",
    "https://telegram-auto-calculator.vercel.app",
    "http://localhost:3000",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Кэш для хранения курсов валют (чтобы не делать запросы каждый раз)
exchange_cache = {
    "rates": None,
    "timestamp": None,
    "ttl": 3600  # Время жизни кэша в секундах (1 час)
}

# Конфигурация логистики
SHIPPING_RATES = {
    "JP": {
        "vladivostok": {"base": 800, "per_km": 0.1, "transit_days": 5},
        "novorossiysk": {"base": 1500, "per_km": 0.15, "transit_days": 25},
        "spb": {"base": 1800, "per_km": 0.12, "transit_days": 28}
    },
    "CN": {
        "vladivostok": {"base": 500, "per_km": 0.08, "transit_days": 3},
        "novorossiysk": {"base": 1200, "per_km": 0.12, "transit_days": 22},
        "spb": {"base": 1500, "per_km": 0.10, "transit_days": 25}
    },
    "KR": {
        "vladivostok": {"base": 400, "per_km": 0.07, "transit_days": 2},
        "novorossiysk": {"base": 1100, "per_km": 0.11, "transit_days": 20},
        "spb": {"base": 1400, "per_km": 0.09, "transit_days": 23}
    }
}

def fetch_exchange_rates() -> Dict[str, Any]:
    """Получение курсов валют с кэшированием"""
    current_time = datetime.now()
    
    # Проверяем, есть ли актуальный кэш
    if (exchange_cache["rates"] and 
        exchange_cache["timestamp"] and 
        (current_time - exchange_cache["timestamp"]).seconds < exchange_cache["ttl"]):
        return exchange_cache["rates"]
    
    try:
        # Пробуем получить данные от ЦБ РФ
        cbr_response = requests.get(
            "https://www.cbr-xml-daily.ru/daily_json.js",
            timeout=5
        )
        cbr_response.raise_for_status()
        cbr_data = cbr_response.json()
        
        # Извлекаем нужные курсы
        rates = {
            "USD": {
                "value": cbr_data["Valute"]["USD"]["Value"],
                "nominal": cbr_data["Valute"]["USD"]["Nominal"],
                "rub": cbr_data["Valute"]["USD"]["Value"] / cbr_data["Valute"]["USD"]["Nominal"]
            },
            "JPY": {
                "value": cbr_data["Valute"]["JPY"]["Value"],
                "nominal": cbr_data["Valute"]["JPY"]["Nominal"],
                "rub": cbr_data["Valute"]["JPY"]["Value"] / cbr_data["Valute"]["JPY"]["Nominal"]
            },
            "CNY": {
                "value": cbr_data["Valute"]["CNY"]["Value"],
                "nominal": cbr_data["Valute"]["CNY"]["Nominal"],
                "rub": cbr_data["Valute"]["CNY"]["Value"] / cbr_data["Valute"]["CNY"]["Nominal"]
            }
        }
        
        # Для KRW используем фиксированный курс (его нет в данных ЦБ)
        rates["KRW"] = {
            "value": 0.067,
            "nominal": 1,
            "rub": 0.067
        }
        
        # Обновляем кэш
        exchange_cache["rates"] = rates
        exchange_cache["timestamp"] = current_time
        
        return rates
        
    except requests.RequestException as e:
        # Если не удалось получить данные, используем fallback значения
        print(f"Ошибка получения курсов валют: {e}")
        
        fallback_rates = {
            "USD": {"value": 90.5, "nominal": 1, "rub": 90.5},
            "JPY": {"value": 0.60, "nominal": 1, "rub": 0.60},
            "CNY": {"value": 11.5, "nominal": 1, "rub": 11.5},
            "KRW": {"value": 0.067, "nominal": 1, "rub": 0.067}
        }
        
        return fallback_rates

@app.get("/")
async def root():
    """Корневой endpoint для проверки работы API"""
    return {
        "message": "AutoImport Calculator API",
        "version": "1.0.0",
        "endpoints": {
            "rates": "/api/rates",
            "shipping": "/api/shipping/{country_code}",
            "calculate": "/api/calculate",
            "health": "/api/health"
        }
    }

@app.get("/api/rates")
async def get_exchange_rates():
    """Получение актуальных курсов валют"""
    try:
        rates = fetch_exchange_rates()
        
        return {
            "success": True,
            "data": rates,
            "updated": exchange_cache["timestamp"].isoformat() if exchange_cache["timestamp"] else datetime.now().isoformat(),
            "source": "CBR" if exchange_cache["rates"] else "fallback"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Ошибка при получении курсов валют: {str(e)}"
        )

@app.get("/api/shipping/{country_code}")
async def get_shipping_rates(country_code: str):
    """Получение тарифов доставки для конкретной страны"""
    # Приводим код страны к верхнему регистру
    country_code = country_code.upper()
    
    if country_code not in SHIPPING_RATES:
        raise HTTPException(
            status_code=404, 
            detail=f"Тарифы для страны {country_code} не найдены. Доступные страны: {', '.join(SHIPPING_RATES.keys())}"
        )
    
    return {
        "success": True,
        "country": country_code,
        "rates": SHIPPING_RATES[country_code]
    }

@app.get("/api/calculate")
async def calculate_total(
    country: str,
    price: float,
    port: str = "vladivostok",
    shipping_type: str = "container"
):
    """Расчет итоговой стоимости с доставкой"""
    try:
        # Получаем курсы валют
        rates = fetch_exchange_rates()
        
        # Определяем валюту страны
        country_currency = {
            "JP": "JPY",
            "CN": "CNY", 
            "KR": "KRW"
        }.get(country.upper(), "USD")
        
        # Конвертируем цену в рубли
        if country_currency in rates:
            exchange_rate = rates[country_currency]["rub"]
        else:
            exchange_rate = 1  # Fallback
        
        price_rub = price * exchange_rate
        
        # Рассчитываем таможенную пошлину
        customs_rates = {
            "JP": 0.48,  # 48%
            "CN": 0.35,  # 35%
            "KR": 0.40   # 40%
        }
        
        customs_rate = customs_rates.get(country.upper(), 0.30)
        customs_tax = price_rub * customs_rate
        
        # Рассчитываем доставку
        if country.upper() in SHIPPING_RATES and port in SHIPPING_RATES[country.upper()]:
            shipping_config = SHIPPING_RATES[country.upper()][port]
            
            # Множитель типа доставки
            shipping_multiplier = {
                "container": 1.2,
                "ro-ro": 1.0
            }.get(shipping_type, 1.0)
            
            # Конвертируем стоимость доставки из USD в RUB
            shipping_usd = shipping_config["base"] * shipping_multiplier
            shipping_rub = shipping_usd * rates["USD"]["rub"]
        else:
            shipping_rub = 50000  # Значение по умолчанию
        
        # Дополнительные сборы (фиксированные)
        recycling_fee = 20000
        epts_fee = 3000
        
        # Итоговый расчет
        total_rub = price_rub + customs_tax + shipping_rub + recycling_fee + epts_fee
        
        return {
            "success": True,
            "calculation": {
                "input": {
                    "country": country.upper(),
                    "price_original": price,
                    "currency": country_currency,
                    "port": port,
                    "shipping_type": shipping_type
                },
                "breakdown": {
                    "price_rub": round(price_rub, 2),
                    "customs_tax": round(customs_tax, 2),
                    "shipping": round(shipping_rub, 2),
                    "recycling_fee": recycling_fee,
                    "epts_fee": epts_fee,
                    "total": round(total_rub, 2)
                },
                "exchange_rate": exchange_rate,
                "currency_symbol": {
                    "JPY": "¥",
                    "CNY": "¥",
                    "KRW": "₩"
                }.get(country_currency, "$")
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Ошибка при расчете: {str(e)}"
        )

@app.get("/api/health")
async def health_check():
    """Проверка здоровья API"""
    try:
        # Пробуем получить курсы валют для проверки
        rates = fetch_exchange_rates()
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "rates_available": len(rates) > 0,
            "cache_age": str(datetime.now() - exchange_cache["timestamp"]) if exchange_cache["timestamp"] else "No cache"
        }
    except Exception as e:
        return {
            "status": "degraded",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }

@app.get("/api/countries")
async def get_available_countries():
    """Получение списка доступных стран"""
    return {
        "success": True,
        "countries": [
            {"code": "JP", "name": "Япония", "currency": "JPY", "customs_rate": 0.48},
            {"code": "CN", "name": "Китай", "currency": "CNY", "customs_rate": 0.35},
            {"code": "KR", "name": "Корея", "currency": "KRW", "customs_rate": 0.40}
        ]
    }

# Точка входа для запуска сервера
if __name__ == "__main__":
    import uvicorn
    
    print("=" * 50)
    print("🚗 AutoImport Calculator API Server")
    print("=" * 50)
    print("Доступные endpoints:")
    print("  • GET  /              - Информация о API")
    print("  • GET  /api/rates     - Курсы валют")
    print("  • GET  /api/shipping/{country} - Тарифы доставки")
    print("  • GET  /api/calculate - Расчет стоимости")
    print("  • GET  /api/health    - Проверка здоровья")
    print("  • GET  /api/countries - Список стран")
    print("=" * 50)
    
    # Запуск сервера
    uvicorn.run(
        app, 
        host="0.0.0.0",  # Доступ с любого IP
        port=8000,        # Порт по умолчанию
        reload=True       # Автоматическая перезагрузка при изменениях
    )
