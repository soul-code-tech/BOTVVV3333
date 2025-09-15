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
    throw new Error("API keys not configured");
}

function generateSignature(payload, urlEncode = true) {
    const timestamp = Date.now();
    let parameters = "";

    for (const key in payload) {
        if (urlEncode && key !== 'timestamp') {
            parameters += `${key}=${encodeURIComponent(payload[key])}&`;
        } else {
            parameters += `${key}=${payload[key]}&`;
        }
    }

    if (!payload.timestamp) {
        parameters += `timestamp=${timestamp}`;
    } else {
        parameters = parameters.slice(0, -1);
    }

    const signature = CryptoJS.HmacSHA256(parameters, SECRET_KEY).toString(CryptoJS.enc.Hex);
    return { parameters, signature, timestamp };
}

export async function callBingxApi(path, method = 'GET', payload = {}) {
    try {
        const { parameters, signature } = generateSignature(payload, method === 'GET');
        let url;

        if (method === 'GET') {
            url = `${PROTOCOL}://${HOST}${path}?${parameters}&signature=${signature}`;
        }

        const config = {
            method: method,
            url: url,
            headers: {
                'X-BX-APIKEY': API_KEY,
            },
            // ✅ ИСПРАВЛЕНО: Убрана лишняя скобка, правильный синтаксис
            ...(method !== 'GET' && {
                 {
                    ...payload,
                    signature: signature
                }
            })
        };

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

// SPOT API функции
export async function getTickerPrice(symbol) {
    return await callBingxApi(`/openApi/swap/v1/ticker/price`, 'GET', { symbol });
}

export async function getKlines(symbol, interval, limit = 100) {
    return await callBingxApi(`/openApi/swap/v3/quote/klines`, 'GET', { symbol, interval, limit });
}

export async function getAccountInfo() {
    return await callBingxApi(`/openApi/swap/v2/user/balance`, 'GET', {});
}

export async function createOrder(symbol, side, type, quantity, price = null) {
    const payload = {
        symbol,
        side,
        type,
        quantity,
        timestamp: Date.now()
    };
    if (price) payload.price = price;
    return await callBingxApi(`/openApi/swap/v2/trade/order`, 'POST', payload);
}
