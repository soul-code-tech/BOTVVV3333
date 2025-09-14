// bingxApi.js
import CryptoJS from 'crypto-js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const HOST = "open-api.bingx.com";
const PROTOCOL = "https";
const API_KEY = process.env.BINGX_API_KEY;
const SECRET_KEY = process.env.BINGX_SECRET_KEY;

if (!API_KEY || !SECRET_KEY) {
    throw new Error("API keys not configured in environment variables");
}

function generateSignature(payload, urlEncode = true) {
    const timestamp = Date.now();
    let parameters = "";

    // Формируем строку параметров
    for (const key in payload) {
        if (urlEncode && key !== 'timestamp') {
            parameters += `${key}=${encodeURIComponent(payload[key])}&`;
        } else {
            parameters += `${key}=${payload[key]}&`;
        }
    }

    // Добавляем timestamp, если он не был в payload
    if (!payload.timestamp) {
        parameters += `timestamp=${timestamp}`;
    } else {
        parameters = parameters.slice(0, -1); // Убираем последний '&'
    }

    // Генерируем подпись HMAC SHA256
    const signature = CryptoJS.HmacSHA256(parameters, SECRET_KEY).toString(CryptoJS.enc.Hex);

    return {
        parameters,
        signature,
        timestamp
    };
}

export async function callBingxApi(path, method = 'GET', payload = {}) {
    try {
        // Генерируем подпись и параметры
        const { parameters, signature } = generateSignature(payload, method === 'GET');

        let url;
        if (method === 'GET') {
            // Для GET-запросов параметры идут в query string
            url = `${PROTOCOL}://${HOST}${path}?${parameters}&signature=${signature}`;
        }

        const config = {
            method: method,
            url: url,
            headers: {
                'X-BX-APIKEY': API_KEY,
            },
            // Для POST-запросов параметры и подпись идут в теле
            ...(method !== 'GET' && {
                 {
                    ...payload,
                    signature: signature
                }
            })
        };

        const response = await axios(config);

        // Проверяем успешность запроса по коду BingX
        if (response.data.code !== 0) {
            throw new Error(`BingX API Error [${response.data.code}]: ${response.data.msg}`);
        }

        return response.data.data; // Возвращаем только полезные данные
    } catch (error) {
        // Централизованная обработка ошибок
        console.error(`API Request Failed for ${path}:`, error.message);

        // Самодиагностика: логируем коды ошибок для последующего анализа
        if (error.response && error.response.data) {
            const errorCode = error.response.data.code;
            console.warn(`[SELF-DIAGNOSTIC] BingX Error ${errorCode}: ${error.response.data.msg}`);
        }

        throw error; // Пробрасываем ошибку дальше для обработки в логике бота
    }
}

// Экспортируем полезные функции для торговли и анализа

// Получение текущей цены тикера
export async function getTickerPrice(symbol) {
    return await callBingxApi(`/openApi/swap/v1/ticker/price`, 'GET', { symbol });
}

// Получение данных Kline для технического анализа
export async function getKlines(symbol, interval, limit = 100) {
    return await callBingxApi(`/openApi/swap/v3/quote/klines`, 'GET', { symbol, interval, limit });
}

// Получение баланса пользователя (требует разрешений на чтение аккаунта)
export async function getAccountInfo() {
    return await callBingxApi(`/openApi/swap/v2/user/balance`, 'GET', {});
}

// Получение списка активных ордеров
export async function getOpenOrders(symbol) {
    return await callBingxApi(`/openApi/swap/v2/trade/openOrders`, 'GET', { symbol });
}

// Получение времени сервера (для синхронизации)
export async function getServerTime() {
    const response = await axios.get(`${PROTOCOL}://${HOST}/openApi/swap/v2/server/time`);
    return response.data.data.serverTime;
}
