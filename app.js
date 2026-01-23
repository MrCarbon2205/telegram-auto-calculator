// ==================== КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ ====================
const CONFIG = {
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

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentCountry = 'JP';
let exchangeRates = {};
let calculationHistory = [];
let costChart = null;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем историю из localStorage
    try {
        calculationHistory = JSON.parse(localStorage.getItem('autoCalcHistory')) || [];
    } catch (e) {
        calculationHistory = [];
        console.log('Не удалось загрузить историю:', e);
    }
    
    initApp();
    setupEventListeners();
    loadExchangeRates();
    updateCurrentDate();
});

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================
function initApp() {
    updateCurrencyDisplay();
    updateSlider();
    updateCustomsRate();
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
    
    if (priceInput && priceSlider) {
        priceInput.addEventListener('input', function() {
            priceSlider.value = this.value;
            updateSlider();
        });
        
        priceSlider.addEventListener('input', function() {
            priceInput.value = this.value;
            updateSlider();
        });
    }

    // Основные кнопки
    const calculateBtn = document.getElementById('calculate-btn');
    if (calculateBtn) calculateBtn.addEventListener('click', calculateTotal);
    
    const refreshBtn = document.getElementById('refresh-rates');
    if (refreshBtn) refreshBtn.addEventListener('click', loadExchangeRates);
    
    const historyBtn = document.getElementById('history-btn');
    if (historyBtn) historyBtn.addEventListener('click', showHistory);
    
    const backBtn = document.getElementById('back-to-calc');
    if (backBtn) backBtn.addEventListener('click', showCalculator);
    
    const saveBtn = document.getElementById('save-calculation');
    if (saveBtn) saveBtn.addEventListener('click', saveCalculation);
    
    // Модальные окна
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) helpBtn.addEventListener('click', () => showModal('help-modal'));
    
    const closeHelp = document.getElementById('close-help');
    if (closeHelp) closeHelp.addEventListener('click', () => hideModal('help-modal'));
}

// ==================== РАБОТА С КУРСАМИ ВАЛЮТ ====================
async function loadExchangeRates() {
    const refreshBtn = document.getElementById('refresh-rates');
    if (refreshBtn) refreshBtn.classList.add('spin');
    
    try {
        // ВАШ НОВЫЙ КОД - используем Railway API
        const RAILWAY_API_URL = 'https://web-production-54e08.up.railway.app/api/rates';
        
        const response = await fetch(RAILWAY_API_URL, {
            // Добавляем таймаут 5 секунд чтобы избежать зависания
            signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
            throw new Error(`Ошибка сервера: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            exchangeRates = {
                JPY: { rub: data.data.JPY.rub, updated: new Date().toISOString() },
                CNY: { rub: data.data.CNY.rub, updated: new Date().toISOString() },
                KRW: { rub: data.data.KRW.rub, updated: new Date().toISOString() },
                USD: { rub: data.data.USD.rub, updated: new Date().toISOString() }
            };
            showNotification('Курсы загружены с сервера!', 'success');
        } else {
            throw new Error('Сервер вернул ошибку');
        }
        
        updateExchangeDisplay();
        
    } catch (error) {
        console.warn('Ошибка загрузки курсов с Railway:', error);
        
        // Fallback на фиксированные курсы
        exchangeRates = {
            JPY: { rub: 0.60, updated: new Date().toISOString() },
            CNY: { rub: 11.50, updated: new Date().toISOString() },
            KRW: { rub: 0.067, updated: new Date().toISOString() },
            USD: { rub: 90.5, updated: new Date().toISOString() }
        };
        
        showNotification(`Используем локальные курсы (${error.message})`, 'info');
        updateExchangeDisplay();
    } finally {
        if (refreshBtn) refreshBtn.classList.remove('spin');
    }
}

function updateExchangeDisplay() {
    const container = document.getElementById('exchange-rates');
    if (!container || !exchangeRates.USD) return;
    
    container.innerHTML = `
        <span>USD: ${exchangeRates.USD.rub.toFixed(2)} ₽</span>
        <i class="fas fa-sync-alt" id="refresh-rates"></i>
    `;
    
    // Обновляем обработчик для новой кнопки
    const newRefreshBtn = document.getElementById('refresh-rates');
    if (newRefreshBtn) {
        newRefreshBtn.addEventListener('click', loadExchangeRates);
    }
}

function updateCurrencyDisplay() {
    const country = CONFIG.COUNTRIES[currentCountry];
    if (!country) return;
    
    const symbolEl = document.getElementById('currency-symbol');
    const nameEl = document.getElementById('currency-name');
    
    if (symbolEl) symbolEl.textContent = country.symbol;
    if (nameEl) nameEl.textContent = country.currency;
}

function updateCustomsRate() {
    const country = CONFIG.COUNTRIES[currentCountry];
    if (!country) return;
    
    const customsEl = document.getElementById('customs-amount');
    if (customsEl) customsEl.textContent = `${(country.customs * 100)}%`;
}

function updateSlider() {
    const priceInput = document.getElementById('car-price');
    const slider = document.getElementById('price-slider');
    
    if (!priceInput || !slider) return;
    
    const price = parseFloat(priceInput.value) || 0;
    const max = parseFloat(slider.max) || 10000000;
    const percent = Math.min((price / max) * 100, 100);
    
    slider.style.background = 
        `linear-gradient(90deg, var(--primary-color) ${percent}%, #ddd ${percent}%)`;
}

// ==================== РАСЧЕТ СТОИМОСТИ ====================
function calculateTotal() {
    const priceInput = document.getElementById('car-price');
    if (!priceInput) return;
    
    const carPrice = parseFloat(priceInput.value);
    
    if (!carPrice || carPrice <= 0) {
        showNotification('Введите корректную стоимость авто', 'error');
        priceInput.focus();
        return;
    }

    const country = CONFIG.COUNTRIES[currentCountry];
    if (!country) return;
    
    // Конвертация в рубли
    const exchangeRate = exchangeRates[country.currency]?.rub || country.rate;
    const priceInRub = carPrice * exchangeRate;
    
    // Расчет дополнительных расходов
    const customsCheckbox = document.getElementById('customs-tax');
    const customsTax = customsCheckbox && customsCheckbox.checked ? priceInRub * country.customs : 0;
    
    const recyclingCheckbox = document.getElementById('recycling-fee');
    const recyclingFee = recyclingCheckbox && recyclingCheckbox.checked ? 20000 : 0;
    
    const eptsCheckbox = document.getElementById('epts-fee');
    const eptsFee = eptsCheckbox && eptsCheckbox.checked ? 3000 : 0;
    
    // Расчет доставки
    const portSelect = document.getElementById('port-select');
    const shippingType = document.querySelector('input[name="shipping-type"]:checked');
    
    const port = portSelect ? portSelect.value : 'vladivostok';
    const type = shippingType ? shippingType.value : 'container';
    const shippingCost = calculateShippingCost(port, type);
    
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
    const resultsSection = document.getElementById('results-section');
    const historySection = document.getElementById('history-section');
    
    if (resultsSection) resultsSection.style.display = 'block';
    if (historySection) historySection.style.display = 'none';
}

function calculateShippingCost(port, type) {
    const portConfig = CONFIG.PORTS[port];
    const shippingConfig = CONFIG.SHIPPING_TYPES[type];
    
    if (!portConfig || !shippingConfig) return 50000; // Значение по умолчанию
    
    const usdRate = exchangeRates.USD?.rub || 90;
    let costUSD = portConfig.base * shippingConfig.multiplier;
    return costUSD * usdRate;
}

function displayResults(results) {
    // Обновляем значения
    const elements = {
        'car-price-rub': formatCurrency(results.carPrice),
        'customs-price': formatCurrency(results.customs),
        'recycling-price': formatCurrency(results.recycling),
        'epts-price': formatCurrency(results.epts),
        'shipping-price': formatCurrency(results.shipping),
        'total-price': formatCurrency(results.total)
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    
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
    
    // Удаляем старый график если есть
    if (costChart) {
        costChart.destroy();
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
    
    costChart = new Chart(ctx, {
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

// ==================== ИСТОРИЯ РАСЧЕТОВ ====================
function saveCalculation() {
    const priceInput = document.getElementById('car-price');
    const totalPrice = document.getElementById('total-price');
    
    if (!priceInput || !totalPrice) return;
    
    const calculation = {
        id: Date.now(),
        date: new Date().toLocaleString('ru-RU'),
        country: currentCountry,
        price: priceInput.value,
        total: totalPrice.textContent,
        details: {
            carPrice: document.getElementById('car-price-rub')?.textContent || '0 ₽',
            customs: document.getElementById('customs-price')?.textContent || '0 ₽',
            shipping: document.getElementById('shipping-price')?.textContent || '0 ₽'
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
    const resultsSection = document.getElementById('results-section');
    const historySection = document.getElementById('history-section');
    
    if (!historyList || !resultsSection || !historySection) return;
    
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
    
    resultsSection.style.display = 'none';
    historySection.style.display = 'block';
}

function useHistoryItem(id) {
    const item = calculationHistory.find(i => i.id === id);
    if (!item) return;
    
    // Устанавливаем значения из истории
    currentCountry = item.country;
    
    // Активируем выбранную страну
    const countryCard = document.querySelector(`[data-country="${currentCountry}"]`);
    if (countryCard) {
        document.querySelectorAll('.country-card').forEach(c => c.classList.remove('active'));
        countryCard.classList.add('active');
    }
    
    const priceInput = document.getElementById('car-price');
    if (priceInput) {
        priceInput.value = item.price;
        updateSlider();
    }
    
    updateCurrencyDisplay();
    updateCustomsRate();
    
    // Показываем калькулятор
    showCalculator();
    showNotification('Данные загружены из истории', 'success');
}

function showCalculator() {
    const resultsSection = document.getElementById('results-section');
    const historySection = document.getElementById('history-section');
    
    if (resultsSection) resultsSection.style.display = 'block';
    if (historySection) historySection.style.display = 'none';
}

function getCountryName(code) {
    const names = { JP: 'Япония', CN: 'Китай', KR: 'Корея' };
    return names[code] || code;
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function updateCurrentDate() {
    const dateElement = document.getElementById('current-date');
    if (!dateElement) return;
    
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    dateElement.textContent = now.toLocaleDateString('ru-RU', options);
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
        background: ${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    document.body.appendChild(notification);
    
    // Удаляем через 3 секунды
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Добавляем стили для уведомлений и истории
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .notification {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .history-item {
        background: #f8f9fa;
        padding: 15px;
        margin: 10px 0;
        border-radius: 8px;
        border-left: 4px solid #2ecc71;
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
        background: #2ecc71;
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
    
    .spin {
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

// Делаем функции доступными глобально для telegram-app.js
window.currentCountry = currentCountry;
window.calculateTotal = calculateTotal;
