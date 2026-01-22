// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand(); // Раскрываем на весь экран
    
    // Используем тему Telegram
    if (tg.colorScheme === 'dark') {
        document.body.classList.add('dark-theme');
    }
    
    // Настройка основной кнопки
    tg.MainButton.setText('Отправить расчет');
    tg.MainButton.onClick(sendCalculationToBot);
    tg.MainButton.hide();
    
    // Показываем кнопку когда есть результаты
    function updateMainButton(show) {
        if (show) {
            tg.MainButton.show();
        } else {
            tg.MainButton.hide();
        }
    }
    
    // Отправка данных боту
    function sendCalculationToBot() {
        const calculation = {
            country: currentCountry,
            price: document.getElementById('car-price').value,
            total: document.getElementById('total-price').textContent,
            breakdown: {
                carPrice: document.getElementById('car-price-rub').textContent,
                customs: document.getElementById('customs-price').textContent,
                shipping: document.getElementById('shipping-price').textContent
            }
        };
        
        tg.sendData(JSON.stringify(calculation));
        tg.close();
    }
    
    // Показываем/скрываем кнопку при расчете
    const originalCalculate = window.calculateTotal;
    window.calculateTotal = function() {
        originalCalculate();
        updateMainButton(true);
    };
    
    // Кнопка поделиться в Telegram
    document.getElementById('share-btn').addEventListener('click', function() {
        const price = document.getElementById('car-price').value;
        const total = document.getElementById('total-price').textContent;
        const country = document.querySelector('.country-card.active span').textContent;
        
        const shareText = `🚗 Рассчитал стоимость авто из ${country}:\n` +
                         `Исходная цена: ${price} ${document.getElementById('currency-name').textContent}\n` +
                         `Итого с доставкой: ${total}\n\n` +
                         `Попробуй и ты: https://t.me/ishiyama_auto_calculator`;
        
        if (tg) {
            tg.shareMessage(shareText);
        } else {
            // Для веб-версии
            navigator.clipboard.writeText(shareText);
            alert('Текст скопирован в буфер обмена!');
        }
    });
    
    // Получаем данные пользователя
    const user = tg.initDataUnsafe?.user;
    if (user) {
        console.log('Пользователь Telegram:', user);
        // Можно персонализировать приложение
    }
}

// Если не в Telegram, работаем как обычное веб-приложение
else {
    console.log('Приложение запущено вне Telegram');
    
    // Добавляем сообщение о возможностях
    const container = document.querySelector('.container');
    const telegramAlert = document.createElement('div');
    telegramAlert.className = 'telegram-alert';
    telegramAlert.innerHTML = `
        <div class="alert-content">
            <h3><i class="fab fa-telegram"></i> Запустите в Telegram</h3>
            <p>Для полного функционала откройте это приложение через Telegram бота</p>
            <button onclick="window.location.href='https://t.me/your_bot'">
                <i class="fab fa-telegram"></i> Открыть в Telegram
            </button>
        </div>
    `;
    container.insertBefore(telegramAlert, container.firstChild);
    
    // Стили для алерта
    const alertStyle = document.createElement('style');
    alertStyle.textContent = `
        .telegram-alert {
            background: linear-gradient(135deg, #0088cc, #34b7f1);
            color: white;
            padding: 15px;
            text-align: center;
            border-radius: 0 0 var(--radius) var(--radius);
        }
        
        .alert-content button {
            margin-top: 10px;
            padding: 10px 20px;
            background: white;
            color: #0088cc;
            border: none;
            border-radius: 20px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.3s;
        }
        
        .alert-content button:hover {
            transform: scale(1.05);
        }
    `;
    document.head.appendChild(alertStyle);
}
