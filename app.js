window.currentCountry = 'JP';
window.exchangeRates = {};
window.calculationHistory = [];
window.costChart = null;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Восстанавливаем историю из localStorage
    try {
        window.calculationHistory = JSON.parse(localStorage.getItem('autoCalcHistory')) || [];
    } catch (e) {
        window.calculationHistory = [];
    }
    // Конфигурация приложения
const CONFIG = {
    EXCHANGE_API: 'https://api.exchangerate-api.com/v4/latest/',
    CBR_API: 'https://www.cbr-xml-daily.ru/daily_json.js',
    
    COUNTRIES: {
        JP: { currency: 'JPY', symbol: '¥', rate: 0.6, customs: 0.48 },
        CN: { currency: 'CNY', symbol: '¥', rate: 11.5, customs: 0.35 },
        KR: { currency: 'KRW', symbol: '₩', rate: 0.067, customs: 0.40 }
    },
    
    PORTS: {
        vladivostok: { base: 800, perKm: 0.1 },
        novorossiysk: { base: 1500, perKm: 0.15 },
        spb: { base: 1800, perKm: 0.12 }
    },
    
    SHIPPING_TYPES: {
        container: { multiplier: 1.2 },
        'ro-ro': { multiplier: 1.0 }
    }
};

// Глобальные переменные
let currentCountry = 'JP';
let exchangeRates = {};
let calculationHistory = JSON.parse(localStorage.getItem('autoCalcHistory')) || [];

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    setupEventListeners();
    loadExchangeRates();
    updateCurrentDate();
});

function initApp() {
    // Установка начальных значений
    updateCurrencyDisplay();
    updateSlider();
}

function setupEventListeners() {
    // Выбор страны
    document.querySelectorAll('.country-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.country-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            currentCountry = this.dataset.country;
            updateCurrencyDisplay();
            updateCustomsRate();
        });
    });

    // Ввод цены
    const priceInput = document.getElementById('car-price');
    const priceSlider = document.getElementById('price-slider');
    
    priceInput.addEventListener('input', function() {
        priceSlider.value = this.value;
        updateSlider();
    });
    
    priceSlider.addEventListener('input', function() {
        priceInput.value = this.value;
        updateSlider();
    });

    // Кнопка расчета
    document.getElementById('calculate-btn').addEventListener('click', calculateTotal);

    // Обновление курсов
    document.getElementById('refresh-rates').addEventListener('click', loadExchangeRates);

    // История
    document.getElementById('history-btn').addEventListener('click', showHistory);
    document.getElementById('back-to-calc').addEventListener('click', showCalculator);

    // Сохранение
    document.getElementById('save-calculation').addEventListener('click', saveCalculation);

    // Модальные окна
    document.getElementById('help-btn').addEventListener('click', () => showModal('help-modal'));
    document.getElementById('close-help').addEventListener('click', () => hideModal('help-modal'));
}

// Функции для работы с валютами
async function loadExchangeRates() {
    const refreshBtn = document.getElementById('refresh-rates');
    refreshBtn.classList.add('spin');
    
    try {
        // Используем фиксированные курсы для демо
        // В реальном приложении замените на API запрос
       async function loadRealExchangeRates() {
    try {
        // API ЦБ РФ
        const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
        const data = await response.json();
        
        exchangeRates = {
            USD: { rub: data.Valute.USD.Value, updated: data.Date },
            JPY: { rub: data.Valute.JPY.Value / data.Valute.JPY.Nominal, updated: data.Date},
            CNY: { rub: data.Valute.CNY.Value / data.Valute.CNY.Nominal, updated: data.Date}
        };
    } catch (error) {
        // Fallback на статические данные
        console.log('Использую статические курсы');
    }
}

function updateExchangeDisplay() {
    const container = document.getElementById('exchange-rates');
    if (!exchangeRates.USD) return;
    
    container.innerHTML = `
        <span>USD: ${exchangeRates.USD.rub.toFixed(2)} ₽</span>
        <i class="fas fa-sync-alt" id="refresh-rates"></i>
    `;
    
    // Обновляем слушатель событий
    document.getElementById('refresh-rates').addEventListener('click', loadExchangeRates);
}

function updateCurrencyDisplay() {
    const country = CONFIG.COUNTRIES[currentCountry];
    document.getElementById('currency-symbol').textContent = country.symbol;
    document.getElementById('currency-name').textContent = country.currency;
}

function updateCustomsRate() {
    const country = CONFIG.COUNTRIES[currentCountry];
    document.getElementById('customs-amount').textContent = `${(country.customs * 100)}%`;
}

function updateSlider() {
    const price = document.getElementById('car-price').value;
    const max = document.getElementById('price-slider').max;
    const percent = (price / max) * 100;
    document.getElementById('price-slider').style.background = 
        `linear-gradient(90deg, var(--primary-color) ${percent}%, #ddd ${percent}%)`;
}

// Основная функция расчета
function calculateTotal() {
    const priceInput = document.getElementById('car-price');
    const carPrice = parseFloat(priceInput.value);
    
    if (!carPrice || carPrice <= 0) {
        showNotification('Введите корректную стоимость авто', 'error');
        priceInput.focus();
        return;
    }

    const country = CONFIG.COUNTRIES[currentCountry];
    
    // Конвертация в рубли
    const exchangeRate = exchangeRates[country.currency]?.rub || country.rate;
    const priceInRub = carPrice * exchangeRate;
    
    // Расчет дополнительных расходов
    const customsTax = document.getElementById('customs-tax').checked ? 
        priceInRub * country.customs : 0;
    
    const recyclingFee = document.getElementById('recycling-fee').checked ? 20000 : 0;
    const eptsFee = document.getElementById('epts-fee').checked ? 3000 : 0;
    
    // Расчет доставки
    const port = document.getElementById('port-select').value;
    const shippingType = document.querySelector('input[name="shipping-type"]:checked').value;
    const shippingCost = calculateShippingCost(port, shippingType);
    
    // Итог
    const total = priceInRub + customsTax + recyclingFee + eptsFee + shippingCost;
    
    // Отображение результатов
    displayResults({
        carPrice: priceInRub,
        customs: customsTax,
        recycling: recyclingFee,
        epts: eptsFee,
        shipping: shippingCost,
        total: total
    });
    
    // Показываем секцию результатов
    document.getElementById('results-section').style.display = 'block';
    document.getElementById('history-section').style.display = 'none';
}

function calculateShippingCost(port, type) {
    const portConfig = CONFIG.PORTS[port];
    const shippingConfig = CONFIG.SHIPPING_TYPES[type];
    const usdRate = exchangeRates.USD?.rub || 90;
    
    let costUSD = portConfig.base * shippingConfig.multiplier;
    return costUSD * usdRate;
}

function displayResults(results) {
    // Обновляем значения
    document.getElementById('car-price-rub').textContent = formatCurrency(results.carPrice);
    document.getElementById('customs-price').textContent = formatCurrency(results.customs);
    document.getElementById('recycling-price').textContent = formatCurrency(results.recycling);
    document.getElementById('epts-price').textContent = formatCurrency(results.epts);
    document.getElementById('shipping-price').textContent = formatCurrency(results.shipping);
    document.getElementById('total-price').textContent = formatCurrency(results.total);
    
    // Обновляем график
    updateChart(results);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function updateChart(results) {
    const ctx = document.getElementById('cost-chart');
    if (!ctx) return;
    // Убедитесь что Canvas контекст доступен
    const context = ctx.getContext('2d');
    if (!context) return;
    
    //const ctx = document.getElementById('cost-chart').getContext('2d');
       // Удаляем старый график если есть
    //if (window.costChart) {
    //    window.costChart.destroy();
    }
    
    const data = {
        labels: ['Авто', 'Таможня', 'Утильсбор', 'ЭПТС', 'Доставка'],
        datasets: [{
            data: [
                results.carPrice,
                results.customs,
                results.recycling,
                results.epts,
                results.shipping
            ],
            backgroundColor: [
                '#2ecc71', '#3498db', '#e74c3c', '#f39c12', '#9b59b6'
            ]
        }]
    };
    
    window.costChart = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// История расчетов
function saveCalculation() {
    const calculation = {
        id: Date.now(),
        date: new Date().toLocaleString('ru-RU'),
        country: currentCountry,
        price: document.getElementById('car-price').value,
        total: document.getElementById('total-price').textContent,
        details: {
            carPrice: document.getElementById('car-price-rub').textContent,
            customs: document.getElementById('customs-price').textContent,
            shipping: document.getElementById('shipping-price').textContent
        }
    };
    
    calculationHistory.unshift(calculation);
    if (calculationHistory.length > 20) {
        calculationHistory = calculationHistory.slice(0, 20);
    }
    
    localStorage.setItem('autoCalcHistory', JSON.stringify(calculationHistory));
    showNotification('Расчет сохранен!', 'success');
}

function showHistory() {
    const historyList = document.getElementById('history-list');
    
    if (calculationHistory.length === 0) {
        historyList.innerHTML = '<p class="empty-history">Нет сохраненных расчетов</p>';
    } else {
        historyList.innerHTML = calculationHistory.map(item => `
            <div class="history-item">
                <div class="history-header">
                    <span class="history-date">${item.date}</span>
                    <span class="history-country">${getCountryName(item.country)}</span>
                </div>
                <div class="history-details">
                    <span>Стоимость: ${item.details.carPrice}</span>
                    <span>Итого: <strong>${item.total}</strong></span>
                </div>
                <button class="history-use-btn" data-id="${item.id}">
                    <i class="fas fa-redo"></i> Использовать
                </button>
            </div>
        `).join('');
        
        // Добавляем обработчики для кнопок
        document.querySelectorAll('.history-use-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                useHistoryItem(id);
            });
        });
    }
    
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('history-section').style.display = 'block';
}

function useHistoryItem(id) {
    const item = calculationHistory.find(i => i.id === id);
    if (!item) return;
    
    // Устанавливаем значения из истории
    currentCountry = item.country;
    document.querySelector(`[data-country="${currentCountry}"]`).click();
    document.getElementById('car-price').value = item.price;
    updateSlider();
    
    // Показываем калькулятор
    showCalculator();
    showNotification('Данные загружены из истории', 'success');
}

function showCalculator() {
    document.getElementById('history-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
}

function getCountryName(code) {
    const names = { JP: 'Япония', CN: 'Китай', KR: 'Корея' };
    return names[code] || code;
}

// Вспомогательные функции
function updateCurrentDate() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    document.getElementById('current-date').textContent = 
        now.toLocaleDateString('ru-RU', options);
}

function showNotification(message, type = 'info') {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Стили для уведомления
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#2ecc71' : '#e74c3c'};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Добавляем стили для уведомлений и истории
const style = document.createElement('style');
style.textContent = `
    .notification {
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .history-item {
        background: var(--light-color);
        padding: 15px;
        margin: 10px 0;
        border-radius: 8px;
        border-left: 4px solid var(--primary-color);
    }
    
    .history-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
        color: #666;
    }
    
    .history-details {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
    }
    
    .history-use-btn {
        width: 100%;
        padding: 8px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: opacity 0.3s;
    }
    
    .history-use-btn:hover {
        opacity: 0.9;
    }
    
    .empty-history {
        text-align: center;
        padding: 30px;
        color: #666;
        font-style: italic;
    }
`;
document.head.appendChild(style);
