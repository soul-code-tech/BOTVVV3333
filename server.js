// ✅ server.js — ИСПРАВЛЕННАЯ ВЕРСИЯ (работает с фьючерсами, нет 404, нет NaN)
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

// ✅ Эндпоинт для получения пароля
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        data: { // ✅ ИСПРАВЛЕНО: убрана лишняя скобка, добавлено "data"
            webPassword: process.env.WEB_INTERFACE_PASSWORD || 'admin123'
        }
    });
});

// ✅ Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', time: new Date().toISOString() });
});

// ✅ API: получить статус бота
app.get('/api/bot/status', async (req, res) => {
    try {
        const status = getBotStatus();
        const ticker = await getTickerPrice("BTC-USDT");
        status.currentPrice = ticker.price || "N/A";

        let availableBalance = "0 USDT";
        if (!status.settings.useDemoMode) {
            const account = await getAccountInfo();
            // ✅ ИСПРАВЛЕНО: правильный путь к балансу для фьючерсов
            if (account && account.assets && account.assets.length > 0) {
                const usdtAsset = account.assets.find(a => a.asset === 'USDT');
                if (usdtAsset && usdtAsset.walletBalance) {
                    availableBalance = `${parseFloat(usdtAsset.walletBalance).toFixed(2)} USDT`;
                } else if (account.walletBalance) {
                    availableBalance = `${parseFloat(account.walletBalance).toFixed(2)} USDT`;
                }
            }
        } else {
            availableBalance = `${(status.demoBalances.USDT || 0).toFixed(2)} USDT`;
        }
        status.availableBalance = availableBalance;
        status.lastUpdate = new Date().toISOString();

        res.json({ success: true, data: status }); // ✅ ИСПРАВЛЕНО: добавлено "data"
    } catch (error) {
        console.error("Ошибка /api/bot/status:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ API: сохранить настройки
app.post('/api/bot/settings', (req, res) => {
    try {
        updateBotSettings(req.body);
        res.json({ success: true, message: "Настройки сохранены" });
    } catch (error) {
        console.error("Ошибка /api/bot/settings:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ API: торговать сейчас
app.post('/api/bot/trade-now', async (req, res) => {
    try {
        await executeTradingLogic();
        res.json({ success: true, message: "Торговля запущена", timestamp: new Date().toISOString() });
    } catch (error) {
        console.error("Ошибка /api/bot/trade-now:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ API: принудительная сделка
app.post('/api/bot/force-trade', async (req, res) => {
    try {
        await forceDailyTrade();
        res.json({ success: true, message: "Принудительная сделка запущена", timestamp: new Date().toISOString() });
    } catch (error) {
        console.error("Ошибка /api/bot/force-trade:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ Главная страница — перенаправление на /dashboard
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

// ✅ Страница дашборда
app.get('/dashboard', (req, res) => {
    const dashboardPath = path.join(__dirname, 'public', 'dashboard.html');
    res.sendFile(dashboardPath, (err) => {
        if (err) {
            console.error('[❌] Ошибка отправки dashboard.html:', err.message);
            res.status(404).send('Dashboard not found. Please check if public/dashboard.html exists.');
        }
    });
});

// ✅ Обработка 404
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        requestedPath: req.path
    });
});

// ✅ Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Интерфейс: https://botvvv3333-2.onrender.com/dashboard`);
    console.log(`🔒 Пароль берётся из WEB_INTERFACE_PASSWORD`);

    startMultiPairAnalysis();
    setInterval(forceDailyTrade, 24 * 60 * 60 * 1000);
});
