// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';

dotenv.config();

import { getTickerPrice, getKlines, createOrder, getAccountInfo, getOpenOrders } from './bingxApi.js';
import { generateTradingSignal } from './technicalAnalysis.js';
import { updateBotSettings, executeTradingLogic, getBotStatus, startMultiPairAnalysis } from './bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const WEB_PASSWORD = process.env.WEB_INTERFACE_PASSWORD || 'admin123';
console.log(`🔒 Пароль интерфейса: ${WEB_PASSWORD}`);

// Middleware аутентификации
app.use('/dashboard', (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Требуется пароль' });
    const token = auth.split(' ')[1];
    if (token !== WEB_PASSWORD) return res.status(403).json({ error: 'Неверный пароль' });
    next();
});

// API: статус бота
app.get('/api/bot/status', async (req, res) => {
    try {
        const status = getBotStatus();
        const ticker = await getTickerPrice(status.settings.tradingPair);
        status.currentPrice = ticker.price || "N/A";
        const account = await getAccountInfo();
        const quoteAsset = status.settings.tradingPair.split('-')[1];
        status.availableBalance = account.balances?.find(b => b.asset === quoteAsset)?.free || "0";
        const openOrders = await getOpenOrders(status.settings.tradingPair);
        status.openOrdersCount = Array.isArray(openOrders) ? openOrders.length : 0;
        res.json({ success: true,  status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: сохранить настройки
app.post('/api/bot/settings', (req, res) => {
    try {
        const settings = req.body;
        updateBotSettings(settings);
        res.json({ success: true, message: "Настройки сохранены" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: торговать сейчас
app.post('/api/bot/trade-now', async (req, res) => {
    try {
        await executeTradingLogic();
        res.json({ success: true, message: "Анализ запущен" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🚨 ВАЖНО: Перенаправляем корень на /dashboard
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Панель управления
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', time: new Date().toISOString() });
});

// Обработка 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Интерфейс: https://botvvv3333-2.onrender.com`);
    console.log(`📊 Health check: https://botvvv3333-2.onrender.com/health`);

    // Запускаем анализ всех пар
    startMultiPairAnalysis();
});
