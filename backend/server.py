from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import bcrypt
import jwt
import asyncio
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ---------- MongoDB ----------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---------- App ----------
app = FastAPI(title="Laxmi Electronics ERP API")
api = APIRouter(prefix="/api")

# ---------- Constants ----------
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

ROLES = [
    "super_admin", "owner", "store_manager", "sales_executive",
    "cashier", "warehouse_staff", "technician", "accountant",
]

# ---------- Helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- Pydantic Models ----------
class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    created_at: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "cashier"

class Category(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    description: str = ""
    created_at: str = Field(default_factory=now_iso)

class Brand(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    country: str = ""
    created_at: str = Field(default_factory=now_iso)

class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    sku: str
    name: str
    category_id: Optional[str] = None
    brand_id: Optional[str] = None
    model: str = ""
    color: str = ""
    capacity: str = ""
    purchase_price: float = 0.0
    selling_price: float = 0.0
    discount: float = 0.0
    gst_rate: float = 18.0
    quantity: int = 0
    reorder_level: int = 5
    warehouse: str = "Main Store"
    shelf: str = ""
    image_url: str = ""
    barcode: str = ""
    warranty_months: int = 12
    hsn_code: str = ""
    created_at: str = Field(default_factory=now_iso)

class ProductIn(BaseModel):
    sku: Optional[str] = None
    name: str
    category_id: Optional[str] = None
    brand_id: Optional[str] = None
    model: str = ""
    color: str = ""
    capacity: str = ""
    purchase_price: float = 0.0
    selling_price: float = 0.0
    discount: float = 0.0
    gst_rate: float = 18.0
    quantity: int = 0
    reorder_level: int = 5
    warehouse: str = "Main Store"
    shelf: str = ""
    image_url: str = ""
    warranty_months: int = 12
    hsn_code: str = ""

class Customer(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    phone: str = ""
    email: str = ""
    gst_number: str = ""
    address: str = ""
    birthday: Optional[str] = None
    loyalty_points: int = 0
    total_spent: float = 0.0
    created_at: str = Field(default_factory=now_iso)

class CustomerIn(BaseModel):
    name: str
    phone: str = ""
    email: str = ""
    gst_number: str = ""
    address: str = ""
    birthday: Optional[str] = None

class Supplier(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    contact_person: str = ""
    phone: str = ""
    email: str = ""
    gst_number: str = ""
    address: str = ""
    outstanding: float = 0.0
    created_at: str = Field(default_factory=now_iso)

class SupplierIn(BaseModel):
    name: str
    contact_person: str = ""
    phone: str = ""
    email: str = ""
    gst_number: str = ""
    address: str = ""

class SaleItem(BaseModel):
    product_id: str
    product_name: str
    sku: str
    hsn_code: str = ""
    quantity: int
    unit_price: float
    discount: float = 0.0
    gst_rate: float = 18.0
    gst_amount: float = 0.0
    line_total: float

class SaleIn(BaseModel):
    customer_id: Optional[str] = None
    customer_name: str = "Walk-in Customer"
    items: List[SaleItem]
    payment_method: Literal["cash", "upi", "card", "credit", "emi", "split"] = "cash"
    payment_received: float = 0.0
    notes: str = ""

class Sale(BaseModel):
    id: str = Field(default_factory=new_id)
    invoice_number: str
    customer_id: Optional[str] = None
    customer_name: str
    items: List[SaleItem]
    subtotal: float
    total_gst: float
    total_discount: float
    grand_total: float
    payment_method: str
    payment_received: float
    balance: float
    status: str = "completed"
    cashier_id: str
    cashier_name: str
    notes: str = ""
    created_at: str = Field(default_factory=now_iso)


# ---------- Auth Routes ----------
@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie(
        key="access_token", value=token, httponly=True,
        secure=True, samesite="none", max_age=43200, path="/",
    )
    return {
        "user": {"id": user["id"], "email": user["email"], "name": user["name"],
                 "role": user["role"], "created_at": user["created_at"]},
        "access_token": token,
    }

@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response, current: dict = Depends(get_current_user)):
    if current["role"] not in ("super_admin", "owner"):
        raise HTTPException(status_code=403, detail="Only admin can create users")
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "id": new_id(),
        "email": payload.email.lower(),
        "name": payload.name,
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    return {"id": user_doc["id"], "email": user_doc["email"], "name": user_doc["name"],
            "role": user_doc["role"], "created_at": user_doc["created_at"]}

@api.get("/auth/me")
async def me(current: dict = Depends(get_current_user)):
    return current

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


# ---------- Users ----------
@api.get("/users")
async def list_users(current: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


# ---------- Settings ----------
DEFAULT_SETTINGS = {
    "business_name": "LAXMI ELECTRONICS",
    "address_line1": "Madarihat Bazar",
    "address_line2": "Alipurduar, West Bengal (WB - 19), PIN Code 735220, India",
    "phone": "7501324188",
    "email": "laxmielectronicsmdt@gmail.com",
    "gstin": "19CJVPM7881F1ZH",
    "state_code": "19",
    "state_name": "West Bengal",
    "bank_name": "",
    "bank_account": "",
    "bank_ifsc": "",
    "invoice_note": "Goods once sold will not be returned.\nThanks for visiting our store.",
}

@api.get("/settings")
async def get_settings(current: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"id": "business"}, {"_id": 0})
    if not doc:
        doc = {"id": "business", **DEFAULT_SETTINGS}
        await db.settings.insert_one(doc)
    return doc

@api.put("/settings")
async def update_settings(payload: dict, current: dict = Depends(get_current_user)):
    payload.pop("_id", None); payload.pop("id", None)
    await db.settings.update_one({"id": "business"}, {"$set": payload}, upsert=True)
    return await db.settings.find_one({"id": "business"}, {"_id": 0})


# ---------- Categories ----------
@api.get("/categories")
async def list_categories(current: dict = Depends(get_current_user)):
    return await db.categories.find({}, {"_id": 0}).to_list(500)

@api.post("/categories")
async def create_category(payload: dict, current: dict = Depends(get_current_user)):
    cat = Category(**payload).model_dump()
    await db.categories.insert_one(cat)
    return cat


# ---------- Brands ----------
@api.get("/brands")
async def list_brands(current: dict = Depends(get_current_user)):
    return await db.brands.find({}, {"_id": 0}).to_list(500)

@api.post("/brands")
async def create_brand(payload: dict, current: dict = Depends(get_current_user)):
    brand = Brand(**payload).model_dump()
    await db.brands.insert_one(brand)
    return brand


# ---------- Products ----------
async def generate_sku(name: str) -> str:
    prefix = "".join([c for c in name.upper() if c.isalpha()])[:3] or "PRD"
    count = await db.products.count_documents({})
    return f"{prefix}-{1000 + count + 1}"

@api.get("/products")
async def list_products(q: str = "", current: dict = Depends(get_current_user)):
    query = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"sku": {"$regex": q, "$options": "i"}},
            {"model": {"$regex": q, "$options": "i"}},
            {"barcode": {"$regex": q, "$options": "i"}},
        ]}
    products = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return products

@api.post("/products")
async def create_product(payload: ProductIn, current: dict = Depends(get_current_user)):
    data = payload.model_dump()
    if not data.get("sku"):
        data["sku"] = await generate_sku(data["name"])
    product = Product(**data).model_dump()
    product["barcode"] = product["sku"]
    await db.products.insert_one(product)
    return product

@api.put("/products/{product_id}")
async def update_product(product_id: str, payload: dict, current: dict = Depends(get_current_user)):
    payload.pop("id", None)
    result = await db.products.update_one({"id": product_id}, {"$set": payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return await db.products.find_one({"id": product_id}, {"_id": 0})

@api.delete("/products/{product_id}")
async def delete_product(product_id: str, current: dict = Depends(get_current_user)):
    await db.products.delete_one({"id": product_id})
    return {"ok": True}

@api.post("/products/{product_id}/adjust-stock")
async def adjust_stock(product_id: str, payload: dict, current: dict = Depends(get_current_user)):
    delta = int(payload.get("delta", 0))
    reason = payload.get("reason", "manual adjustment")
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    new_qty = max(0, product.get("quantity", 0) + delta)
    await db.products.update_one({"id": product_id}, {"$set": {"quantity": new_qty}})
    await db.stock_movements.insert_one({
        "id": new_id(), "product_id": product_id, "delta": delta,
        "reason": reason, "user": current["name"], "at": now_iso(),
    })
    return {"quantity": new_qty}


# ---------- Customers ----------
@api.get("/customers")
async def list_customers(q: str = "", current: dict = Depends(get_current_user)):
    query = {}
    if q:
        query = {"$or": [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]}
    return await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/customers")
async def create_customer(payload: CustomerIn, current: dict = Depends(get_current_user)):
    cust = Customer(**payload.model_dump()).model_dump()
    await db.customers.insert_one(cust)
    return cust

@api.put("/customers/{customer_id}")
async def update_customer(customer_id: str, payload: dict, current: dict = Depends(get_current_user)):
    payload.pop("id", None)
    await db.customers.update_one({"id": customer_id}, {"$set": payload})
    return await db.customers.find_one({"id": customer_id}, {"_id": 0})

@api.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current: dict = Depends(get_current_user)):
    await db.customers.delete_one({"id": customer_id})
    return {"ok": True}


# ---------- Suppliers ----------
@api.get("/suppliers")
async def list_suppliers(current: dict = Depends(get_current_user)):
    return await db.suppliers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/suppliers")
async def create_supplier(payload: SupplierIn, current: dict = Depends(get_current_user)):
    sup = Supplier(**payload.model_dump()).model_dump()
    await db.suppliers.insert_one(sup)
    return sup

@api.put("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: str, payload: dict, current: dict = Depends(get_current_user)):
    payload.pop("id", None)
    await db.suppliers.update_one({"id": supplier_id}, {"$set": payload})
    return await db.suppliers.find_one({"id": supplier_id}, {"_id": 0})

@api.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: str, current: dict = Depends(get_current_user)):
    await db.suppliers.delete_one({"id": supplier_id})
    return {"ok": True}


# ---------- Sales / POS ----------
async def next_invoice_number() -> str:
    year = datetime.now(timezone.utc).year
    count = await db.sales.count_documents({})
    return f"LE-{year}-{1000 + count + 1}"

@api.post("/sales")
async def create_sale(payload: SaleIn, current: dict = Depends(get_current_user)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="No items in sale")

    # Validate stock and compute totals
    subtotal = 0.0
    total_gst = 0.0
    total_discount = 0.0
    computed_items = []
    for item in payload.items:
        product = await db.products.find_one({"id": item.product_id})
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {item.product_name} not found")
        if product["quantity"] < item.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {item.product_name}")
        base = (item.unit_price * item.quantity) - item.discount
        gst_amount = round(base * item.gst_rate / 100, 2)
        line_total = round(base + gst_amount, 2)
        subtotal += base
        total_gst += gst_amount
        total_discount += item.discount
        computed_items.append({
            **item.model_dump(),
            "hsn_code": item.hsn_code or product.get("hsn_code", ""),
            "gst_amount": gst_amount, "line_total": line_total,
        })

    grand_total = round(subtotal + total_gst, 2)
    balance = round(grand_total - payload.payment_received, 2) if payload.payment_method == "credit" else 0.0
    status = "credit" if payload.payment_method == "credit" and balance > 0 else "completed"

    sale = {
        "id": new_id(),
        "invoice_number": await next_invoice_number(),
        "customer_id": payload.customer_id,
        "customer_name": payload.customer_name,
        "items": computed_items,
        "subtotal": round(subtotal, 2),
        "total_gst": round(total_gst, 2),
        "total_discount": round(total_discount, 2),
        "grand_total": grand_total,
        "payment_method": payload.payment_method,
        "payment_received": payload.payment_received if payload.payment_method == "credit" else grand_total,
        "balance": balance,
        "status": status,
        "cashier_id": current["id"],
        "cashier_name": current["name"],
        "notes": payload.notes,
        "created_at": now_iso(),
    }

    # Deduct stock
    for item in computed_items:
        await db.products.update_one(
            {"id": item["product_id"]},
            {"$inc": {"quantity": -item["quantity"]}}
        )

    # Update customer stats & loyalty
    if payload.customer_id:
        points = int(grand_total // 100)
        await db.customers.update_one(
            {"id": payload.customer_id},
            {"$inc": {"total_spent": grand_total, "loyalty_points": points}},
        )

    await db.sales.insert_one(sale)
    sale.pop("_id", None)
    return sale

@api.get("/sales")
async def list_sales(limit: int = 100, current: dict = Depends(get_current_user)):
    return await db.sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)

@api.get("/sales/{sale_id}")
async def get_sale(sale_id: str, current: dict = Depends(get_current_user)):
    s = await db.sales.find_one({"id": sale_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Sale not found")
    return s


# ---------- Dashboard ----------
@api.get("/dashboard/summary")
async def dashboard_summary(current: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    month_start = datetime.now(timezone.utc).replace(day=1).date().isoformat()

    sales_all = await db.sales.find({}, {"_id": 0}).to_list(5000)
    today_sales = [s for s in sales_all if s["created_at"][:10] == today]
    month_sales = [s for s in sales_all if s["created_at"][:10] >= month_start]

    today_total = sum(s["grand_total"] for s in today_sales)
    month_total = sum(s["grand_total"] for s in month_sales)

    # Profit approximation: selling - purchase * qty for each item
    today_profit = 0.0
    for s in today_sales:
        for it in s["items"]:
            product = await db.products.find_one({"id": it["product_id"]})
            if product:
                today_profit += (it["unit_price"] - product.get("purchase_price", 0)) * it["quantity"]

    products = await db.products.find({}, {"_id": 0}).to_list(2000)
    stock_value = sum(p["quantity"] * p.get("purchase_price", 0) for p in products)
    total_units = sum(p["quantity"] for p in products)
    low_stock = [p for p in products if p["quantity"] <= p.get("reorder_level", 5)]

    outstanding = sum(s.get("balance", 0) for s in sales_all if s.get("status") == "credit")

    customer_count = await db.customers.count_documents({})

    # Sales trend (last 7 days)
    trend = {}
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        trend[d] = 0.0
    for s in sales_all:
        day = s["created_at"][:10]
        if day in trend:
            trend[day] += s["grand_total"]
    sales_trend = [{"date": d, "total": round(v, 2)} for d, v in trend.items()]

    # Category pie
    categories = await db.categories.find({}, {"_id": 0}).to_list(200)
    cat_map = {c["id"]: c["name"] for c in categories}
    cat_sales = {}
    for s in sales_all:
        for it in s["items"]:
            product = await db.products.find_one({"id": it["product_id"]})
            if product and product.get("category_id"):
                cname = cat_map.get(product["category_id"], "Other")
                cat_sales[cname] = cat_sales.get(cname, 0) + it["line_total"]
    category_breakdown = [{"category": k, "value": round(v, 2)} for k, v in cat_sales.items()]

    # Top products
    top_map = {}
    for s in sales_all:
        for it in s["items"]:
            top_map.setdefault(it["product_name"], {"name": it["product_name"], "qty": 0, "revenue": 0})
            top_map[it["product_name"]]["qty"] += it["quantity"]
            top_map[it["product_name"]]["revenue"] += it["line_total"]
    top_products = sorted(top_map.values(), key=lambda x: x["revenue"], reverse=True)[:5]

    # Top cashiers
    cashier_map = {}
    for s in sales_all:
        cashier_map.setdefault(s["cashier_name"], 0)
        cashier_map[s["cashier_name"]] += s["grand_total"]
    top_cashiers = [{"name": k, "total": round(v, 2)} for k, v in sorted(cashier_map.items(), key=lambda x: x[1], reverse=True)][:5]

    return {
        "today_sales": round(today_total, 2),
        "month_sales": round(month_total, 2),
        "today_profit": round(today_profit, 2),
        "stock_value": round(stock_value, 2),
        "total_units": total_units,
        "low_stock_count": len(low_stock),
        "low_stock_items": low_stock[:10],
        "outstanding_payments": round(outstanding, 2),
        "customer_count": customer_count,
        "pending_orders": len([s for s in sales_all if s.get("status") == "credit"]),
        "sales_trend": sales_trend,
        "category_breakdown": category_breakdown,
        "top_products": top_products,
        "top_cashiers": top_cashiers,
    }


# ---------- AI Insights ----------
@api.post("/ai/insights")
async def ai_insights(payload: dict, current: dict = Depends(get_current_user)):
    """Ask Claude Sonnet for AI insights based on ERP data."""
    kind = payload.get("kind", "sales_prediction")

    # Build context summary
    products = await db.products.find({}, {"_id": 0}).to_list(500)
    sales = await db.sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

    top_map = {}
    for s in sales:
        for it in s["items"]:
            top_map.setdefault(it["product_name"], 0)
            top_map[it["product_name"]] += it["quantity"]
    top_summary = sorted(top_map.items(), key=lambda x: x[1], reverse=True)[:10]

    low_stock = [p for p in products if p["quantity"] <= p.get("reorder_level", 5)]

    prompts = {
        "sales_prediction": (
            "You are a retail analytics assistant for Laxmi Electronics (Indian electronics retailer). "
            f"Recent sales snapshot ({len(sales)} transactions). Top selling items: {top_summary}. "
            "Give a concise 5-bullet forecast for the next 30 days: expected demand trends, "
            "categories to push, seasonal notes, and 2 quick action items. Keep it under 250 words."
        ),
        "inventory_forecast": (
            "You are an inventory expert for an Indian electronics store. "
            f"Products low on stock: {[(p['name'], p['quantity']) for p in low_stock[:15]]}. "
            f"Top movers: {top_summary}. "
            "Recommend reorder quantities and safety stock levels in 5 bullets. Under 250 words."
        ),
        "product_recommendations": (
            "You are a merchandising expert. "
            f"Given best-sellers {top_summary} at Laxmi Electronics, suggest 5 cross-sell / upsell "
            "bundles or promotions with expected margin impact. Under 250 words."
        ),
    }
    prompt = prompts.get(kind, prompts["sales_prediction"])

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"erp-{current['id']}-{kind}",
            system_message="You are a business intelligence expert specialising in Indian electronics retail. Be concise, actionable, and use INR (₹) for money.",
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        response = await chat.send_message(UserMessage(text=prompt))
        return {"kind": kind, "insight": response}
    except Exception as e:
        logging.exception("AI insight failed")
        raise HTTPException(status_code=500, detail=f"AI service error: {e}")


# ---------- Seed Data ----------
async def seed_data():
    # Admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "id": new_id(), "email": admin_email, "name": "Laxmi Admin",
            "role": "super_admin",
            "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
            "created_at": now_iso(),
        })

    # Extra test users
    for email, name, role, pw in [
        ("cashier@laxmielectronics.com", "Ravi Cashier", "cashier", "Cashier@123"),
        ("manager@laxmielectronics.com", "Anita Manager", "store_manager", "Manager@123"),
    ]:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "id": new_id(), "email": email, "name": name, "role": role,
                "password_hash": hash_password(pw), "created_at": now_iso(),
            })

    # Categories
    if await db.categories.count_documents({}) == 0:
        cats = ["Televisions", "Refrigerators", "Air Conditioners", "Washing Machines",
                "Kitchen Appliances", "Audio & Speakers", "Fans & Coolers", "Accessories"]
        for c in cats:
            await db.categories.insert_one(Category(name=c).model_dump())

    # Brands
    if await db.brands.count_documents({}) == 0:
        brands = ["Samsung", "LG", "Sony", "Whirlpool", "Bosch", "Panasonic",
                  "Godrej", "Havells", "Bajaj", "Voltas"]
        for b in brands:
            await db.brands.insert_one(Brand(name=b).model_dump())

    # Products
    if await db.products.count_documents({}) == 0:
        cat_docs = await db.categories.find({}, {"_id": 0}).to_list(50)
        brand_docs = await db.brands.find({}, {"_id": 0}).to_list(50)
        cat_id = lambda n: next((c["id"] for c in cat_docs if c["name"] == n), None)
        brand_id = lambda n: next((b["id"] for b in brand_docs if b["name"] == n), None)

        sample = [
            ("Samsung Crystal 4K 55\" Smart TV", "Televisions", "Samsung", 42000, 55990, 18, "85287200",
             "https://images.unsplash.com/photo-1646861039459-fd9e3aabf3fb?crop=entropy&cs=srgb&fm=jpg&w=640"),
            ("LG 260L Double Door Refrigerator", "Refrigerators", "LG", 22000, 28990, 18, "84182100",
             "https://images.unsplash.com/photo-1758488438758-5e2eedf769ce?crop=entropy&cs=srgb&fm=jpg&w=640"),
            ("Voltas 1.5T 5-Star Inverter AC", "Air Conditioners", "Voltas", 32000, 42990, 28, "84151010",
             "https://images.unsplash.com/photo-1585771724684-38269d6639fd?crop=entropy&cs=srgb&fm=jpg&w=640"),
            ("Whirlpool 7kg Front Load Washer", "Washing Machines", "Whirlpool", 21000, 26990, 18, "84501900",
             "https://images.pexels.com/photos/7282378/pexels-photo-7282378.jpeg?auto=compress&w=640"),
            ("Panasonic 25L Convection Microwave", "Kitchen Appliances", "Panasonic", 8500, 11990, 18, "85165000",
             "https://images.unsplash.com/photo-1740803292822-a742c6a4fef0?crop=entropy&cs=srgb&fm=jpg&w=640"),
            ("Sony SRS-XB43 Bluetooth Speaker", "Audio & Speakers", "Sony", 12000, 16990, 18, "85182200",
             "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?crop=entropy&cs=srgb&fm=jpg&w=640"),
            ("Havells Ceiling Fan Enticer 1200mm", "Fans & Coolers", "Havells", 2200, 3290, 12, "84145120",
             "https://images.unsplash.com/photo-1587212805350-8b48fcaf62c1?crop=entropy&cs=srgb&fm=jpg&w=640"),
            ("Bajaj Mixer Grinder 750W", "Kitchen Appliances", "Bajaj", 2400, 3490, 18, "85094010",
             "https://images.unsplash.com/photo-1590779033100-9f60a05a013d?crop=entropy&cs=srgb&fm=jpg&w=640"),
            ("Bosch 8kg Fully Automatic Washer", "Washing Machines", "Bosch", 28000, 35990, 18, "84501900",
             "https://images.unsplash.com/photo-1626806787461-102c1a6f8c8f?crop=entropy&cs=srgb&fm=jpg&w=640"),
            ("Godrej 190L Single Door Fridge", "Refrigerators", "Godrej", 14500, 18490, 18, "84182100",
             "https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?crop=entropy&cs=srgb&fm=jpg&w=640"),
            ("LG OLED 65\" Evo C3 4K TV", "Televisions", "LG", 155000, 199990, 28, "85287200",
             "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?crop=entropy&cs=srgb&fm=jpg&w=640"),
            ("Voltas Desert Air Cooler 70L", "Fans & Coolers", "Voltas", 9800, 13490, 18, "84796000",
             "https://images.unsplash.com/photo-1585771724684-38269d6639fd?crop=entropy&cs=srgb&fm=jpg&w=640"),
        ]
        count = 0
        for name, cat, brand, pp, sp, gst, hsn, img in sample:
            count += 1
            p = Product(
                sku=f"LE-{1000+count}", name=name,
                category_id=cat_id(cat), brand_id=brand_id(brand),
                purchase_price=pp, selling_price=sp, gst_rate=gst,
                quantity=15 if "OLED" not in name else 3,
                reorder_level=5, image_url=img, warranty_months=24, hsn_code=hsn,
            ).model_dump()
            p["barcode"] = p["sku"]
            await db.products.insert_one(p)

    # Sample customers
    if await db.customers.count_documents({}) == 0:
        samples = [
            ("Rajesh Kumar", "9876543210", "rajesh@example.com"),
            ("Priya Sharma", "9123456780", "priya@example.com"),
            ("Amit Verma", "9988776655", "amit@example.com"),
            ("Sneha Reddy", "9345671234", "sneha@example.com"),
        ]
        for name, phone, email in samples:
            c = Customer(name=name, phone=phone, email=email, address="Mumbai, MH").model_dump()
            await db.customers.insert_one(c)

    # Sample suppliers
    if await db.suppliers.count_documents({}) == 0:
        for name, contact in [
            ("Samsung India Ltd.", "Rakesh Malhotra"),
            ("LG Electronics", "Suresh Iyer"),
            ("Whirlpool India", "Deepa Menon"),
            ("Panasonic Distributors", "Vikram Singh"),
        ]:
            s = Supplier(name=name, contact_person=contact,
                         phone="0221234567", email=f"{name.split()[0].lower()}@vendor.com",
                         gst_number="27AABCS1234F1Z5", address="MIDC, Mumbai").model_dump()
            await db.suppliers.insert_one(s)

    # Sample sales (past 7 days) - only seed if empty
    if await db.sales.count_documents({}) == 0:
        prods = await db.products.find({}, {"_id": 0}).to_list(50)
        custs = await db.customers.find({}, {"_id": 0}).to_list(20)
        users_c = await db.users.find({"role": "cashier"}, {"_id": 0}).to_list(5)
        cashier = users_c[0] if users_c else {"id": "seed", "name": "System"}
        import random
        for i in range(20):
            day_offset = random.randint(0, 6)
            when = datetime.now(timezone.utc) - timedelta(days=day_offset, hours=random.randint(0, 12))
            picks = random.sample(prods, k=min(random.randint(1, 3), len(prods)))
            items = []
            subtotal = 0.0; gst_sum = 0.0
            for p in picks:
                qty = random.randint(1, 2)
                unit = p["selling_price"]
                base = unit * qty
                gst = round(base * p["gst_rate"] / 100, 2)
                items.append({
                    "product_id": p["id"], "product_name": p["name"], "sku": p["sku"],
                    "quantity": qty, "unit_price": unit, "discount": 0.0,
                    "gst_rate": p["gst_rate"], "gst_amount": gst, "line_total": round(base + gst, 2),
                })
                subtotal += base; gst_sum += gst
            grand = round(subtotal + gst_sum, 2)
            cust = random.choice(custs) if custs else None
            inv = f"LE-{when.year}-{2000 + i}"
            sale = {
                "id": new_id(), "invoice_number": inv,
                "customer_id": cust["id"] if cust else None,
                "customer_name": cust["name"] if cust else "Walk-in Customer",
                "items": items, "subtotal": round(subtotal, 2),
                "total_gst": round(gst_sum, 2), "total_discount": 0.0,
                "grand_total": grand, "payment_method": random.choice(["cash", "upi", "card"]),
                "payment_received": grand, "balance": 0.0, "status": "completed",
                "cashier_id": cashier["id"], "cashier_name": cashier["name"],
                "notes": "", "created_at": when.isoformat(),
            }
            await db.sales.insert_one(sale)


# ---------- App startup ----------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("sku")
    await db.sales.create_index("created_at")
    await seed_data()

@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

# CORS - allow_credentials requires explicit origin
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
allow_origins = [frontend_url, "http://localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("erp")
