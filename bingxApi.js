// bingxApi.js — РАБОЧАЯ ВЕРСИЯ ДЛЯ SPOT
import CryptoJS from 'crypto-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HOST = "open-api.bingx.com";
const PROTOCOL = "https";
const API_KEY = process.env.BINGX_API_KEY;
const SECRET_KEY = process.env.BINGX_SECRET_KEY;

if (!API_KEY || !SECRET_KEY) {
    throw new Error("BINGX_API_KEY и BINGX_SECRET_KEY должны быть заданы в .env");
}

function generateSignature(payload) {
    const timestamp = Date.now();
    const sortedKeys = Object.keys(payload).sort();
    let parameters = "";

    for (const key of sortedKeys) {
        if (key !== 'timestamp') {
            parameters += `${key}=${encodeURIComponent(payload[key])}&`;
        }
    }
    parameters += `timestamp=${timestamp}`;

    return {
        parameters,
        signature: CryptoJS.HmacSHA256(parameters, SECRET_KEY).toString(CryptoJS.enc.Hex),
        timestamp
    };
}

export async function callBingxApi(path, method = 'GET', payload = {}) {
    try {
        const { parameters, signature } = generateSignature(payload);
        let url = `${PROTOCOL}://${HOST}${path}?${parameters}&signature=${signature}`;

        const config = {
            method,
            url,
            headers: { 'X-BX-APIKEY': API_KEY }
        };

        if (method !== 'GET') {
            config.data = { ...payload, timestamp: Date.now(), signature };
        }

        const response = await axios(config);

        if (response.data.code !== 0) {
            throw new Error(`BingX API Error [${response.data.code}]: ${response.data.msg}`);
        }

        return response.data.data;
    } catch (error) {
        console.error(`API Error for ${path}:`, error.message);
        throw error;
    }
}

// ✅ Получить цену
export async function getTickerPrice(symbol) {
    const cleanSymbol = symbol.replace('-', '');
    return await callBingxApi(`/openApi/spot/v1/market/ticker`, 'GET', { symbol: cleanSymbol });
}

// ✅ Получить свечи
export async function getKlines(symbol, interval, limit = 100) {
    const cleanSymbol = symbol.replace('-', '');
    return await callBingxApi(`/openApi/spot/v1/market/kline`, 'GET', { symbol: cleanSymbol, interval, limit });
}

// ✅ Получить баланс
export async function getAccountInfo() {
    return await callBingxApi(`/openApi/spot/v1/account/balance`, 'GET', {});
}

// ✅ Создать ордер
export async function createOrder(symbol, side, type, quantity, price = null, stopPrice = null) {
    const cleanSymbol = symbol.replace('-', '');
    const payload = {
        symbol: cleanSymbol,
        side: side.toUpperCase(),
        type: type.toUpperCase(),
        quantity: parseFloat(quantity).toFixed(8)
    };
    if (price) payload.price = parseFloat(price).toFixed(8);
    if (stopPrice) payload.stopPrice = parseFloat(stopPrice).toFixed(8);
    return await callBingxApi(`/openApi/spot/v1/trade/order`, 'POST', payload);
}
