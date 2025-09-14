// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';

// Загружаем переменные окружения
dotenv.config();

// Импортируем модули бота
import { getTickerPrice, getKlines, createOrder, getAccountBalance, getOpenOrders, callBingxApi } from './bingxApi.js';
import { generateTradingSignal } from './technicalAnalysis.js';
import { updateBotSettings } from './bot.js'; // Пока не создан, но будет на следующем шаге

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Для простоты разработки
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Простая аутентификация для веб-интерфейса
const WEB_PASSWORD = process.env.WEB_INTERFACE_PASSWORD;

if (!WEB_PASSWORD) {
    console.warn("⚠️  WEB_INTERFACE_PASSWORD не задан в переменных окружения. Установите его для безопасности.");
}

// Middleware для аутентификации
app.use('/dashboard', (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Требуется аутентификация', code: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (token !== WEB_PASSWORD) {
        return res.status(403).json({ error: 'Неверный пароль', code: 403 });
    }
    next();
});

// Роут для получения текущего состояния бота
app.get('/api/bot/status', async (req, res) => {
    try {
        // Получаем баланс
        const balanceData = await getAccountBalance();
        const availableBalance = balanceData.balance.availableBalance || 0;

        // Получаем активные ордера
        const openOrders = await getOpenOrders("BTC-USDT"); // Пока фиксированная пара

        // Получаем текущую цену
        const ticker = await getTickerPrice("BTC-USDT");
        const currentPrice = ticker.price || "N/A";

        // Здесь можно добавить данные о последнем сигнале (из bot.js в будущем)
        const status = {
            isRunning: true,
            lastSignal: "NEUTRAL",
            lastSignalTime: new Date().toISOString(),
            currentPair: "BTC-USDT",
            currentPrice: currentPrice,
            availableBalance: `${availableBalance} USDT`,
            openOrdersCount: Array.isArray(openOrders) ? openOrders.length : 0,
            serverTime: new Date().toISOString()
        };

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error("Ошибка при получении статуса бота:", error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.response?.data?.code || 500
        });
    }
});

// Роут для обновления настроек бота
app.post('/api/bot/settings', async (req, res) => {
    try {
        const newSettings = req.body;

        // Валидация обязательных полей
        if (!newSettings.tradingPair || !newSettings.strategy) {
            return res.status(400).json({
                success: false,
                error: "Необходимо указать tradingPair и strategy"
            });
        }

        // Обновляем настройки бота
        updateBotSettings(newSettings);

        res.json({
            success: true,
            message: "Настройки успешно обновлены",
            settings: newSettings
        });
    } catch (error) {
        console.error("Ошибка при обновлении настроек:", error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Роут для ручного запуска торговой логики (для тестирования)
app.post('/api/bot/trade-now', async (req, res) => {
    try {
        // Здесь можно вызвать основную торговую функцию из bot.js
        // Пока заглушка
        const result = {
            message: "Торговая логика будет запущена в фоновом режиме",
            timestamp: new Date().toISOString()
        };

        // В будущем: вызов executeTradingLogic() из bot.js

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Основной роут для веб-интерфейса
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health check для Render
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: Date.now() });
});

// Обработка 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Глобальный обработчик ошибок
app.use((error, req, res, next) => {
    console.error('Необработанная ошибка:', error);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`🌐 Веб-интерфейс: http://localhost:${PORT}/dashboard`);
    console.log(`🔒 Пароль для доступа: ${WEB_PASSWORD || 'не задан'}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
