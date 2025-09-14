// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';

dotenv.config();

// Импортируем модули бота
import { getTickerPrice, getKlines, createOrder, getAccountInfo, getOpenOrders } from './bingxApi.js';
import { generateTradingSignal } from './technicalAnalysis.js';
import { updateBotSettings, executeTradingLogic, getBotStatus } from './bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000; // Render по умолчанию использует 10000

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Простая аутентификация
const WEB_PASSWORD = process.env.WEB_INTERFACE_PASSWORD;

if (!WEB_PASSWORD) {
    console.warn("⚠️  WEB_INTERFACE_PASSWORD не задан. Установите его в Render Environment.");
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

// Роут для получения состояния бота
app.get('/api/bot/status', async (req, res) => {
    try {
        const ticker = await getTickerPrice(botSettings.tradingPair);
        const account = await getAccountInfo();
        const openOrders = await getOpenOrders(botSettings.tradingPair);

        const status = getBotStatus();
        status.currentPrice = ticker.price || "N/A";
        status.availableBalance = account.balances?.find(b => b.asset === botSettings.tradingPair.split('-')[1])?.free || "0";
        status.openOrdersCount = Array.isArray(openOrders) ? openOrders.length : 0;

        res.json({
            success: true,
             status
        });
    } catch (error) {
        console.error("Ошибка статуса:", error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            code: error.response?.data?.code || 500
        });
    }
});

// Сохранение настроек
app.post('/api/bot/settings', async (req, res) => {
    try {
        const newSettings = req.body;
        if (!newSettings.tradingPair || !newSettings.strategy) {
            return res.status(400).json({ success: false, error: "Укажите пару и стратегию" });
        }
        updateBotSettings(newSettings);
        res.json({ success: true, message: "Настройки сохранены", settings: newSettings });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Ручной запуск торговли
app.post('/api/bot/trade-now', async (req, res) => {
    try {
        await executeTradingLogic();
        res.json({ success: true, message: "Торговля запущена", timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Перенаправление корня на /dashboard
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Панель управления
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
    console.error('Ошибка сервера:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
});

// Запуск сервера на 0.0.0.0 и PORT
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Интерфейс: https://botvvv3333-2.onrender.com/dashboard`);
    console.log(`🔒 Пароль: ${WEB_PASSWORD || 'не задан'}`);
});
