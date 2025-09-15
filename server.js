// server.js — ПОЛНОСТЬЮ РАБОЧАЯ ВЕРСИЯ ДЛЯ ФЬЮЧЕРСОВ
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Импортируем функции из bot.js
import { 
    getTickerPrice, 
    getKlines, 
    getAccountInfo 
} from './bingxApi.js';

import { 
    updateBotSettings, 
    executeTradingLogic, 
    getBotStatus, 
    startMultiPairAnalysis, 
    forceDailyTrade 
} from './bot.js';

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
        data: {
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
        
        // ✅ Используем BTC-USDT для получения цены
        const ticker = await getTickerPrice("BTC-USDT");
        status.currentPrice = ticker.price || "N/A";
        
        // ✅ Получаем баланс для фьючерсов
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
        
        res.json({ success: true, data: status });
    } catch (error) {
        console.error("Ошибка /api/bot/status:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ API: сохранить настройки
app.post('/api/bot/settings', (req, res) => {
    try {
        const settings = req.body;
        console.log("[API] 🔄 Получены настройки:", settings);
        updateBotSettings(settings);
        res.json({ success: true, message: "Настройки сохранены" });
    } catch (error) {
        console.error("Ошибка /api/bot/settings:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ API: торговать сейчас (анализ всех пар)
app.post('/api/bot/trade-now', async (req, res) => {
    try {
        console.log("[API] ⚡ Запущен ручной анализ всех пар");
        await executeTradingLogic();
        res.json({ success: true, message: "Анализ всех пар запущен", timestamp: new Date().toISOString() });
    } catch (error) {
        console.error("Ошибка /api/bot/trade-now:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ API: принудительная сделка
app.post('/api/bot/force-trade', async (req, res) => {
    try {
        console.log("[API] 📅 Запущена принудительная сделка");
        await forceDailyTrade();
        res.json({ success: true, message: "Принудительная сделка запущена", timestamp: new Date().toISOString() });
    } catch (error) {
        console.error("Ошибка /api/bot/force-trade:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ✅ Роуты для интерфейса
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ✅ Обработка 404
app.use('*', (req, res) => {
    console.log(`[404] Запрошенный путь: ${req.path}`);
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

    // ✅ Запускаем автоматический анализ
    startMultiPairAnalysis();

    // ✅ Принудительная сделка раз в день
    setInterval(forceDailyTrade, 24 * 60 * 60 * 1000); // 24 часа
});
