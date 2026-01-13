# PokePack Tracker

A React web app for tracking Pokemon TCG sealed product prices with live TCGPlayer data and Discord price alerts.

**Live Demo:** [https://spencer4792.github.io/PokePackTracker/](https://spencer4792.github.io/PokePackTracker/)

---

## Features

### Live Price Tracking
- Real-time prices from TCGPlayer via TCGCSV API
- Browse sealed products by set (Booster Boxes, ETBs, Booster Bundles, etc.)
- Compare current prices against MSRP
- Color-coded price indicators (below/at/above MSRP)

### Discord Price Alerts
- Set target prices for any product
- Get instant Discord notifications when prices drop below your target
- Rich embeds with product details, savings calculations, and direct buy links
- Quick preset buttons (MSRP, 10% off, 15% off, 20% off)

### Save & Track
- Save products to your watchlist
- Export price data to CSV
- All settings stored locally in browser

### Clean Interface
- Filter by product type (ETB, Booster Box, etc.)
- Sort by price, name, or set
- Search across all products
- Responsive design for mobile and desktop

---

## Screenshots

### Main Dashboard
Browse products with live TCGPlayer pricing and MSRP comparisons.

### Price Alerts
Set custom price targets and get Discord notifications.

### Discord Notifications
Rich embeds with product info and direct buy links.

---

## Tech Stack

- **Frontend:** React 18 with Hooks
- **Styling:** Custom CSS
- **Build Tool:** Vite
- **Hosting:** GitHub Pages
- **Price Data:** TCGCSV API (TCGPlayer prices)
- **Set Data:** Pokemon TCG API

---

## Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# Clone the repo
git clone https://github.com/Spencer4792/PokePackTracker.git
cd PokePackTracker

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
```

### Deploy to GitHub Pages

```bash
npm run deploy
```

---

## Configuration

### Discord Webhook Setup

1. In Discord, go to Server Settings → Integrations → Webhooks
2. Create a new webhook and copy the URL
3. In the app, click **Settings** → paste your webhook URL → **Test Webhook**
4. Set price alerts on products you want to track

### Setting Price Alerts

1. Click **Alert** on any product card
2. Choose a preset (MSRP, 10% off, etc.) or enter a custom target price
3. Enable "Notify once" if you only want one alert per product
4. When the price drops below your target, you'll get a Discord notification!

## Data Sources

| Data | Source | Update Frequency |
|------|--------|------------------|
| TCGPlayer Prices | TCGCSV API | ~Daily |
| Set Information | Pokemon TCG API | As needed |
| MSRP | Hardcoded | Manual updates |

---

## Related Projects

- **[PokeRestockMonitor](https://github.com/Spencer4792/PokeRestockMonitor)** - Discord bot that monitors retailer restocks (Walmart, Target, Best Buy, GameStop, Pokemon Center) and sends instant alerts when items come back in stock.

---

## Roadmap

- [ ] Price history charts
- [ ] More retailers (when APIs available)
- [ ] Push notifications (PWA)
- [ ] User accounts for cross-device sync

---

## License

MIT License