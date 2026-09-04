# Crypto Futures Scanner

Real-time crypto futures signal scanner dengan MA20/MA50 + Stochastic RSI.

## Cara Jalankan

### 1. Backend (Python FastAPI)
```bash
cd backend
python main.py
```
Backend jalan di: http://localhost:8000

### 2. Frontend (Next.js)
```bash
cd frontend
npm run dev
```
Frontend jalan di: http://localhost:3000

Atau pakai file `.bat` di root folder:
- `start-backend.bat` → jalankan backend
- `start-frontend.bat` → jalankan frontend

---

## Logika Scanner

| Kondisi | Trend |
|---------|-------|
| Harga > MA20 AND Harga > MA50 | Bullish |
| Harga < MA20 AND Harga < MA50 | Bearish |
| Kondisi lain | Neutral |

| Trend | Stoch RSI | Signal |
|-------|-----------|--------|
| Bullish | K < 20 dan D < 20 | **LONG** ✅ |
| Bearish | K > 80 dan D > 80 | **SHORT** ✅ |
| Neutral | — | No signal |

---

## Konfigurasi

Edit file `backend/.env`:

```env
TIMEFRAME=1h          # timeframe candle (1m, 5m, 15m, 1h, 4h, 1d)
MA_FAST=20            # periode MA cepat
MA_SLOW=50            # periode MA lambat
STOCH_RSI_PERIOD=14   # periode Stoch RSI
STOCH_OVERSOLD=20     # threshold oversold
STOCH_OVERBOUGHT=80   # threshold overbought
SCAN_INTERVAL=60      # detik antar scan otomatis
```

---

## Fitur

- ✅ Scan semua USDT perpetual futures di Binance
- ✅ MA20/MA50 trend detection
- ✅ Stochastic RSI confirmation
- ✅ K/D cross detection
- ✅ Live WebSocket updates ke frontend
- ✅ TradingView chart embed (auto-switch ke coin yang dipilih)
- ✅ Filter Long/Short/All
- ✅ Search symbol
- ✅ Signal strength score
- ✅ Detail panel dengan gauge Stoch RSI
- ✅ Manual trigger scan
- ✅ Auto reconnect WebSocket
