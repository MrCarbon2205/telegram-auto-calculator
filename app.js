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

// Объявляем переменные глобально для доступа из telegram-app.js
window.currentCountry = 'JP';
window.exchangeRates = {};
window.calculationHistory = JSON.parse(localStorage.getItem('autoCalcHistory')) || [];
window.costChart = null;

// ==================== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ====================
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    setupEventListeners();
    loadExchangeRates();
    updateCurrentDate();
});

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================
function initApp() {
    updateCurrencyDisplay();
    updateSlider();
}

function setupEventListeners() {
    // Выбор страны
    document.querySelectorAll('.country-card').forEach(card => {
        card.addEventListener('click', function() {
            document.querySelectorAll('.country-card').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            window.currentCountry = this.dataset.country; // Используем window.
            updateCurrencyDisplay();
            updateCustomsRate();
        });
    });

    // Ввод цены и слайдер
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

    // Основные кнопки
    document.getElementById('calculate-btn').addEventListener('click', calculateTotal);
    document.getElementById('refresh-rates').addEventListener('click', loadExchangeRates);
    document.getElementById('history-btn').addEventListener('click', showHistory);
    document.getElementById('back-to-calc').addEventListener('click', showCalculator);
    document.getElementById('save-calculation').addEventListener('click', saveCalculation);
    document.getElementById('help-btn').addEventListener('click', () => showModal('help-modal'));
    document.getElementById('close-help').addEventListener('click', () => hideModal('help-modal'));
}

// ==================== РАБОТА С КУРСАМИ ВАЛЮТ ====================
async function loadExchangeRates() {
    const refreshBtn = document.getElementById('refresh-rates');
    refreshBtn.classList.add('spin');
    
    try {
        // ФИКСИРОВАННЫЕ КУРСЫ ДЛЯ ДЕМО (работает стабильно)
        window.exchangeRates = { // Используем window.
            JPY: { rub: 0.60, updated: new Date().toISOString() },
            CNY: { rub: 11.50, updated: new Date().toISOString() },
            KRW: { rub: 0.067, updated: new Date().toISOString() },
            USD: { rub: 90.5, updated: new Date().toISOString() }
        };
        
        updateExchangeDisplay();
        showNotification('Курсы обновлены!', 'success');
    } catch (error) {
        console.error('Ошибка загрузки курсов:', error);
        showNotification('Ошибка загрузки курсов', 'error');
    } finally {
        refreshBtn.classList.remove('spin');
    }
}

function updateExchangeDisplay() {
    const container = document.getElementById('exchange-rates');
    if (!window.exchangeRates.USD) return; // Используем window.
    
    container.innerHTML = `
        <span>USD: ${window.exchangeRates.USD.rub.toFixed(2)} ₽</span>
        <i class="fas fa-sync-alt" id="refresh-rates"></i>
    `;
    // Слушатель для кнопки обновления уже назначен в setupEventListeners()
}

function updateCurrencyDisplay() {
    const country = CONFIG.COUNTRIES[window.currentCountry]; // Используем window.
    document.getElementById('currency-symbol').textContent = country.symbol;
    document.getElementById('currency-name').textContent = country.currency;
}

function updateCustomsRate() {
    const country = CONFIG.COUNTRIES[window.currentCountry]; // Используем window.
    document.getElementById('customs-amount').textContent = `${(country.customs * 100)}%`;
}

// ==================== РАСЧЕТ СТОИМОСТИ ====================
function calculateTotal() {
    const priceInput = document.getElementById('car-price');
    const carPrice = parseFloat(priceInput.value);
    
    if (!carPrice || carPrice <= 0) {
        showNotification('Введите корректную стоимость авто', 'error');
        priceInput.focus();
        return;
    }

    const country = CONFIG.COUNTRIES[window.currentCountry]; // Используем window.
    const exchangeRate = window.exchangeRates[country.currency]?.rub || country.rate; // Используем window.
    const priceInRub = carPrice * exchangeRate;
    
    const customsTax = document.getElementById('customs-tax').checked ? priceInRub * country.customs : 0;
    const recyclingFee = document.getElementById('recycling-fee').checked ? 20000 : 0;
    const eptsFee = document.getElementById('epts-fee').checked ? 3000 : 0;
    
    const port = document.getElementById('port-select').value;
    const shippingType = document.querySelector('input[name="shipping-type"]:checked').value;
    const shippingCost = calculateShippingCost(port, shippingType);
    
    const total = priceInRub + customsTax + recyclingFee + eptsFee + shippingCost;
    
    displayResults({
        carPrice: priceInRub,
        customs: customsTax,
        recycling: recyclingFee,
        epts: eptsFee,
        shipping: shippingCost,
        total: total
    });
    
    document.getElementById('results-section').style.display = 'block';
    document.getElementById('history-section').style.display = 'none';
}

function calculateShippingCost(port, type) {
    const portConfig = CONFIG.PORTS[port];
    const shippingConfig = CONFIG.SHIPPING_TYPES[type];
    const usdRate = window.exchangeRates.USD?.rub || 90; // Используем window.
    
    let costUSD = portConfig.base * shippingConfig.multiplier;
    return costUSD * usdRate;
}

// ==================== ИСТОРИЯ РАСЧЕТОВ ====================
function saveCalculation() {
    const calculation = {
        id: Date.now(),
        date: new Date().toLocaleString('ru-RU'),
        country: window.currentCountry, // Используем window.
        price: document.getElementById('car-price').value,
        total: document.getElementById('total-price').textContent,
        details: {
            carPrice: document.getElementById('car-price-rub').textContent,
            customs: document.getElementById('customs-price').textContent,
            shipping: document.getElementById('shipping-price').textContent
        }
    };
    
    window.calculationHistory.unshift(calculation); // Используем window.
    if (window.calculationHistory.length > 20) {
        window.calculationHistory = window.calculationHistory.slice(0, 20);
    }
    
    localStorage.setItem('autoCalcHistory', JSON.stringify(window.calculationHistory));
    showNotification('Расчет сохранен!', 'success');
}
