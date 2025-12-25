# PestiScan Web 🌿🧪
AI-based pesticide risk detection system (Web)

PestiScan is a farmer-friendly web application that estimates **pesticide risk on crop leaves** using image analysis, environmental data, and scientifically inspired decay logic.

---

## ✨ Key Features (v1.0)
- Leaf image upload for risk analysis
- AI-assisted leaf stress indicators (non-blocking in v1.0)
- Pesticide risk percentage calculation
- Risk level output: **Low / Medium / High**
- Scan history stored locally in browser
- Clean and readable UI (Scan & History polished)

---

## 🧠 How It Works (High Level)
PestiScan combines multiple factors to estimate risk:
- Visual leaf stress indicators (color, texture)
- Days since last pesticide spray
- Pesticide half-life decay formula
- Leaf pH, soil pH, moisture (manual inputs)
- Optional weather influence (expandable)

Each factor contributes to a weighted final risk score.

---

## 🧱 Tech Stack
**Frontend**
- Vite
- React
- JavaScript
- CSS / Tailwind

**Backend**
- Node.js
- Express

---

## 📁 Project Structure
PestiScan-web/
├─ client/ # React (Vite) frontend
├─ server/ # Express backend (API)
├─ shared/ # Shared risk logic & utilities
└─ README.md

---

## 🖥️ Run Locally (Exact Commands)

### Backend — Express (Port 5174)
```powershell
cd "C:\Users\Prem Kumar\Documents\GitHub\PestiScan-web\server"
node index.js
Health check:
http://localhost:5174/api/health
Stop server: Ctrl + C
Frontend — Vite + React (Port 5173)
cd "C:\Users\Prem Kumar\Documents\GitHub\PestiScan-web\client"
npm run dev
Open in browser:
http://localhost:5173
Stop server: Ctrl + C
🔐 Environment Variables

Create .env files if required (not committed to GitHub).

Example:

VITE_API_BASE=http://localhost:5174

🚀 Deployment (Overview)

Frontend hosted on Vercel

Backend hosted on Render

Custom domain managed via Squarespace Domains

DNS configured to point to hosting providers

📌 Versioning

Current version: v1.0

v1.0 is feature-locked and focused on:

Core risk calculation

Stable UI

Test scan packs

🛣️ Planned Enhancements

Advanced AI leaf stress detection

Strong AI-generated image blocking (toggle)

Auth & user profiles

Weather-driven dynamic risk

Mobile optimization

⚠️ Disclaimer

PestiScan provides risk estimates only.
It is not a replacement for professional agricultural or regulatory advice.

📄 License

This project is currently for educational and prototyping purposes.


---

### ✅ Where to put it


C:\Users\Prem Kumar\Documents\GitHub\PestiScan-web\README.md


### ✅ After pasting, run:
```powershell
git add README.md
git commit -m "Add final README"
git push