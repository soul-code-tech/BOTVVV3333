// server.js — ИСПРАВЛЕННАЯ ВЕРСИЯ
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

import { getTickerPrice, getAccountInfo } from './bingxApi.js';
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
         {
            webPassword: process.env.WEB_INTERFACE_PASSWORD || 'admin123'
        }
    );
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', time: new Date().toISOString() });
});

app.get('/api/bot/status', async (req, res) => {
    try {
        const status = getBotStatus();
        const ticker = await getTickerPrice("BTC-USDT");
        status.currentPrice = ticker.price || "N/A";

        let availableBalance = "0 USDT";
        if (!status.settings.useDemoMode) {
            const account = await getAccountInfo();
            if (account && account.balance !== undefined) {
                availableBalance = `${parseFloat(account.balance).toFixed(2)} USDT`;
            }
        } else {
            availableBalance = `${status.demoBalances.USDT?.toFixed(2)} USDT`;
        }
        status.availableBalance = availableBalance;
        status.lastUpdate = new Date().toISOString();

        res.json({ success: true,  status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/bot/settings', (req, res) => {
    try {
        updateBotSettings(req.body);
        res.json({ success: true, message: "Настройки сохранены" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/bot/trade-now', async (req, res) => {
    try {
        await executeTradingLogic();
        res.json({ success: true, message: "Анализ и торговля запущены", timestamp: new Date().toISOString() });
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

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Интерфейс: https://botvvv3333-2.onrender.com/dashboard`);
    startMultiPairAnalysis();
    setInterval(forceDailyTrade, 24 * 60 * 60 * 1000);
});
