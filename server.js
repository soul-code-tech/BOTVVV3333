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

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Простой API: статус бота (без аутентификации)
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
        res.status(500).json({ success: false, error: error.message });
    }
});

// Простой API: сохранить настройки (без аутентификации)
app.post('/api/bot/settings', (req, res) => {
    try {
        const settings = req.body;
        updateBotSettings(settings);
        res.json({ success: true, message: "Настройки сохранены" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Простой API: торговать сейчас (без аутентификации)
app.post('/api/bot/trade-now', async (req, res) => {
    try {
        await executeTradingLogic();
        res.json({ success: true, message: "Анализ запущен", timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', time: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Интерфейс: https://botvvv3333-2.onrender.com/dashboard`);
    console.log(`📊 Health check: https://botvvv3333-2.onrender.com/health`);

    // Запускаем анализ
    startMultiPairAnalysis();
});
