// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { getTickerPrice, getKlines, getAccountInfo } from './bingxApi.js';
import { generateTradingSignal } from './technicalAnalysis.js';
import { updateBotSettings, executeTradingLogic, getBotStatus, startMultiPairAnalysis } from './bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', time: new Date().toISOString() });
});

// API: статус бота
app.get('/api/bot/status', async (req, res) => {
    try {
        const status = getBotStatus();
        const ticker = await getTickerPrice(status.settings.tradingPair);
        status.currentPrice = ticker.price || "N/A";
        const account = await getAccountInfo();
        const quoteAsset = status.settings.tradingPair.split('-')[1];
        const balance = account.balances?.find(b => b.asset === quoteAsset);
        status.availableBalance = balance ? parseFloat(balance.free).toFixed(2) + " " + quoteAsset : "0 USDT";
        status.lastUpdate = new Date().toISOString();
        res.json({ success: true,  status });
    } catch (error) {
        console.error("Ошибка /api/bot/status:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: сохранить настройки
app.post('/api/bot/settings', (req, res) => {
    try {
        const settings = req.body;
        console.log("[API] Получены настройки:", settings);
        updateBotSettings(settings);
        res.json({ success: true, message: "Настройки сохранены" });
    } catch (error) {
        console.error("Ошибка /api/bot/settings:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: торговать сейчас
app.post('/api/bot/trade-now', async (req, res) => {
    try {
        console.log("[API] Запущен ручной анализ");
        await executeTradingLogic();
        res.json({ success: true, message: "Анализ запущен", timestamp: new Date().toISOString() });
    } catch (error) {
        console.error("Ошибка /api/bot/trade-now:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Обработка корневого пути — показываем dashboard
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// Панель управления — отдаём HTML
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Обработка 404
app.use('*', (req, res) => {
    console.log(`[404] Запрошенный путь: ${req.path}`);
    res.status(404).json({ 
        error: 'Endpoint not found',
        requestedPath: req.path
    });
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Интерфейс: https://botvvv3333-2.onrender.com/dashboard`);
    console.log(`📊 Health check: https://botvvv3333-2.onrender.com/health`);
    console.log(`⏰ Серверное время: ${new Date().toISOString()}`);

    // Запускаем анализ всех пар
    startMultiPairAnalysis();
});
