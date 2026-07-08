# Laxmi Electronics ERP — Local Setup

Self-hosted, Emergent-free.

## Prerequisites
- Python 3.11+, Node 18+, Yarn, MongoDB running locally on `mongodb://localhost:27017`

## Backend
```bash
cd backend
cp .env.example .env      # edit JWT_SECRET, ADMIN_EMAIL/PASSWORD
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Seeds run automatically on startup (admin, sample products, brands, categories).

## Frontend
```bash
cd frontend
cp .env.example .env      # set REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start                # serves on http://localhost:3000
```

## Default login
- `admin@laxmielectronics.com` / `Admin@123`

## Notes
- AI Insights page & `/api/ai/insights` endpoint removed
- No dependency on `emergentintegrations` or any Emergent LLM key
- All third-party keys are gone; only your own `JWT_SECRET` + `MONGO_URL` are required
- Ingress prefix `/api` is a convention only — safe to keep for local

## Optional: remove emergentintegrations from requirements.txt
```bash
sed -i '/emergentintegrations/d' backend/requirements.txt
```
