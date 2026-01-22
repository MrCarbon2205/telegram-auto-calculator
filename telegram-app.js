// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;

// Вспомогательная функция для безопасного добавления обработчиков после загрузки DOM
function setupTelegramFeatures() {
    // Кнопка "Поделиться"
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            const price = document.getElementById('car-price')?.value || '0';
            const total = document.getElementById('total-price')?.textContent || '0 ₽';
            const countryElement = document.querySelector('.country-card.active span');
            const country = countryElement ? countryElement.textContent : 'Япония';
            const currencyName = document.getElementById('currency-name')?.textContent || '';
            
            const shareText = `🚗 Рассчитал стоимость авто из ${country}:\n` +
                             `Исходная цена: ${price} ${currencyName}\n` +
                             `Итого с доставкой: ${total}\n\n` +
                             `Попробуй и ты: https://t.me/ishiyama_auto_calculator_bot`;

            if (tg && tg.shareMessage) {
                tg.shareMessage(shareText);
            } else if (navigator.share) {
                navigator.share({ text: shareText });
            } else {
                navigator.clipboard.writeText(shareText)
                    .then(() => showNotification('Текст скопирован в буфер обмена!', 'info'))
                    .catch(err => console.error('Ошибка копирования: ', err));
            }
        });
    }
}

if (tg) {
    tg.ready();
    tg.expand();

    if (tg.colorScheme === 'dark') {
        document.body.classList.add('dark-theme');
    }

    tg.MainButton.setText('Отправить расчет');
    tg.MainButton.onClick(sendCalculationToBot);
    tg.MainButton.hide();

    function updateMainButton(show) {
        if (show) {
            tg.MainButton.show();
        } else {
            tg.MainButton.hide();
        }
    }

    function sendCalculationToBot() {
        // Используем window.currentCountry для доступа к глобальной переменной
        const calculation = {
            country: window.currentCountry || 'JP',
            price: document.getElementById('car-price')?.value || '0',
            total: document.getElementById('total-price')?.textContent || '0 ₽',
            breakdown: {
                carPrice: document.getElementById('car-price-rub')?.textContent || '0 ₽',
                customs: document.getElementById('customs-price')?.textContent || '0 ₽',
                shipping: document.getElementById('shipping-price')?.textContent || '0 ₽'
            }
        };
        if (tg.sendData) {
            tg.sendData(JSON.stringify(calculation));
        }
        tg.close();
    }

    const originalCalculate = window.calculateTotal;
    if (originalCalculate) {
        window.calculateTotal = function() {
            const result = originalCalculate.apply(this, arguments);
            updateMainButton(true);
            return result;
        };
    }

    const user = tg.initDataUnsafe?.user;
    if (user) {
        console.log('Пользователь Telegram:', user);
    }

    // Настройка функций Telegram после полной загрузки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupTelegramFeatures);
    } else {
        setupTelegramFeatures();
    }

} else {
    console.log('Приложение запущено вне Telegram');
    // Добавляем сообщение, только если контейнер существует
    const container = document.querySelector('.container');
    if (container) {
        const telegramAlert = document.createElement('div');
        telegramAlert.className = 'telegram-alert';
        // Обновите ссылку в кнопке на актуальную
        telegramAlert.innerHTML = `
            <div class="alert-content">
                <h3><i class="fab fa-telegram"></i> Запустите в Telegram</h3>
                <p>Для полного функционала откройте это приложение через Telegram бота</p>
                <button onclick="window.location.href='https://t.me/ishiyama_auto_calculator_bot'">
                    <i class="fab fa-telegram"></i> Открыть в Telegram
                </button>
            </div>
        `;
        container.insertBefore(telegramAlert, container.firstChild);

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
}
