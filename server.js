// server.js — ИСПРАВЛЕННАЯ ВЕРСИЯ
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { getTickerPrice, getKlines, getAccountInfo } from './bingxApi.js';
import { generateTradingSignal } from './technicalAnalysis.js';
import { updateBotSettings, executeTradingLogic, getBotStatus, startMultiPairAnalysis, forceDailyTrade } from './bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        data: {
            webPassword: process.env.WEB_INTERFACE_PASSWORD || 'admin123'
        }
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', time: new Date().toISOString() });
});

app.get('/api/bot/status', async (req, res) => {
    try {
        const status = getBotStatus();
        const symbol = "BTC-USDT"; // фиксированная пара для статуса
        const ticker = await getTickerPrice(symbol);
        status.currentPrice = ticker.price || "N/A";

        let availableBalance = "0 USDT";
        if (!status.settings.useDemoMode) {
            const account = await getAccountInfo();
            if (account && Array.isArray(account.balances)) {
                const balance = account.balances.find(b => b.asset === 'USDT');
                if (balance) {
                    availableBalance = `${parseFloat(balance.free).toFixed(2)} USDT`;
                }
            }
        } else {
            availableBalance = `${status.demoBalances.USDT?.toFixed(2)} USDT`;
        }
        status.availableBalance = availableBalance;
        status.lastUpdate = new Date().toISOString();

        res.json({ success: true, data: status });
    } catch (error) {
        console.error("Ошибка /api/bot/status:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/bot/settings', (req, res) => {
    try {
        const settings = req.body;
        updateBotSettings(settings);
        res.json({ success: true, message: "Настройки сохранены" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/bot/trade-now', async (req, res) => {
    try {
        await executeTradingLogic();
        res.json({ success: true, message: "Анализ запущен", timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/bot/force-trade', async (req, res) => {
    try {
        await forceDailyTrade();
        res.json({ success: true, message: "Принудительная сделка запущена", timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Интерфейс: http://localhost:${PORT}/dashboard`);
    startMultiPairAnalysis();
    setInterval(forceDailyTrade, 24 * 60 * 60 * 1000);
});
