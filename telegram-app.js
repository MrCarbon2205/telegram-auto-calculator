// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;

if (tg) {
    tg.ready();
    tg.expand();
    
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
            country: window.currentCountry || 'JP',
            price: document.getElementById('car-price')?.value || '0',
            total: document.getElementById('total-price')?.textContent || '0 ₽'
        };
        
        if (tg.sendData) {
            tg.sendData(JSON.stringify(calculation));
        }
        tg.close();
    }
    
    // Перехватываем функцию расчета для показа кнопки
    const originalCalculate = window.calculateTotal;
    if (originalCalculate) {
        window.calculateTotal = function() {
            const result = originalCalculate.apply(this, arguments);
            updateMainButton(true);
            return result;
        };
    }
    
    // Кнопка поделиться
    document.addEventListener('click', function(e) {
        if (e.target.id === 'share-btn' || e.target.closest('#share-btn')) {
            const price = document.getElementById('car-price')?.value || '0';
            const total = document.getElementById('total-price')?.textContent || '0 ₽';
            const countryElement = document.querySelector('.country-card.active span');
            const country = countryElement ? countryElement.textContent : 'Япония';
            
            const shareText = `🚗 Рассчитал стоимость авто из ${country}:\n` +
                             `Исходная цена: ${price}\n` +
                             `Итого с доставкой: ${total}\n\n` +
                             `Попробуй и ты!`;
            
            if (tg.shareMessage) {
                tg.shareMessage(shareText);
            } else if (navigator.share) {
                navigator.share({ text: shareText });
            } else {
                navigator.clipboard.writeText(shareText)
                    .then(() => alert('Текст скопирован в буфер обмена!'));
            }
        }
    });
    
    // Получаем данные пользователя
    const user = tg.initDataUnsafe?.user;
    if (user) {
        console.log('Telegram user:', user);
    }
} else {
    console.log('Приложение запущено вне Telegram');
    
    // Добавляем сообщение если запущено в браузере
    document.addEventListener('DOMContentLoaded', function() {
        const container = document.querySelector('.container');
        if (container) {
            const telegramAlert = document.createElement('div');
            telegramAlert.className = 'telegram-alert';
            telegramAlert.innerHTML = `
                <div class="alert-content">
                    <h3><i class="fab fa-telegram"></i> Запустите в Telegram</h3>
                    <p>Для полного функционала откройте это приложение через Telegram бота</p>
                    <p><small>Сейчас работает демо-версия</small></p>
                </div>
            `;
            
            // Стили для алерта
            const style = document.createElement('style');
            style.textContent = `
                .telegram-alert {
                    background: linear-gradient(135deg, #0088cc, #34b7f1);
                    color: white;
                    padding: 15px;
                    text-align: center;
                    border-radius: 0 0 12px 12px;
                    margin: -20px -20px 20px -20px;
                }
                .alert-content h3 {
                    margin: 0 0 10px 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }
                .alert-content p {
                    margin: 5px 0;
                }
                .alert-content small {
                    opacity: 0.8;
                }
            `;
            document.head.appendChild(style);
            
            container.insertBefore(telegramAlert, container.firstChild);
        }
    });
}
