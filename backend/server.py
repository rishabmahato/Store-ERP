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
    serial_number: str = ""
    serial_numbers: List[str] = []
    purchase_bill_number: str = ""
    source_of_procurement: str = ""
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
    serial_number: str = ""
    serial_numbers: List[str] = []
    purchase_bill_number: str = ""
    source_of_procurement: str = ""

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
    model: str = ""
    hsn_code: str = ""
    serial_numbers: List[str] = []
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
    gst_enabled: bool = True
    bill_discount: float = 0.0

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


@api.post("/products/bulk")
async def bulk_products(payload: dict, current: dict = Depends(get_current_user)):
    rows = payload.get("rows", [])
    created = 0; errors = []
    for i, row in enumerate(rows):
        try:
            if not row.get("name"):
                errors.append({"row": i + 1, "error": "name required"}); continue
            data = {k: row.get(k) for k in row.keys() if k not in ("id", "_id")}
            for k in ("purchase_price", "selling_price", "gst_rate", "quantity", "reorder_level", "warranty_months"):
                if k in data and data[k] not in (None, ""):
                    data[k] = float(data[k]) if "price" in k or "rate" in k else int(float(data[k]))
            if not data.get("sku"):
                data["sku"] = await generate_sku(data["name"])
            product = Product(**data).model_dump()
            product["barcode"] = product["sku"]
            await db.products.insert_one(product)
            created += 1
        except Exception as e:
            errors.append({"row": i + 1, "error": str(e)})
    return {"created": created, "errors": errors}

@api.get("/products/find-by-model")
async def find_by_model(model: str = "", name: str = "", current: dict = Depends(get_current_user)):
    if not model and not name:
        return None
    query = {}
    if model:
        query["model"] = {"$regex": f"^{model}$", "$options": "i"}
    elif name:
        query["name"] = {"$regex": f"^{name}$", "$options": "i"}
    doc = await db.products.find_one(query, {"_id": 0})
    return doc

@api.post("/sales/{sale_id}/cancel")
async def cancel_sale(sale_id: str, current: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if sale.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Already cancelled")
    # Restore stock
    for it in sale["items"]:
        await db.products.update_one({"id": it["product_id"]}, {"$inc": {"quantity": it["quantity"]}})
    await db.sales.update_one({"id": sale_id}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


# ---------- Product Units (per-serial tracking) ----------
class ProductUnit(BaseModel):
    id: str = Field(default_factory=new_id)
    product_id: str
    serial_number: str
    purchase_price: float = 0.0
    selling_price: float = 0.0
    purchase_bill_number: str = ""
    source_of_procurement: str = ""
    purchase_bill_url: str = ""
    status: str = "in_stock"   # in_stock | sold | reserved
    sold_in_sale_id: Optional[str] = None
    sold_at: Optional[str] = None
    notes: str = ""
    created_at: str = Field(default_factory=now_iso)

@api.get("/products/{product_id}/units")
async def list_units(product_id: str, current: dict = Depends(get_current_user)):
    return await db.product_units.find({"product_id": product_id}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/products/{product_id}/units")
async def add_unit(product_id: str, payload: dict, current: dict = Depends(get_current_user)):
    payload["product_id"] = product_id
    unit = ProductUnit(**payload).model_dump()
    await db.product_units.insert_one(unit)
    unit.pop("_id", None)
    # Auto-increment product quantity when a unit is added (only if in_stock)
    if unit.get("status", "in_stock") == "in_stock":
        await db.products.update_one({"id": product_id}, {"$inc": {"quantity": 1}})
    return unit

@api.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, current: dict = Depends(get_current_user)):
    unit = await db.product_units.find_one({"id": unit_id})
    if unit and unit.get("status", "in_stock") == "in_stock":
        await db.products.update_one({"id": unit["product_id"]}, {"$inc": {"quantity": -1}})
    await db.product_units.delete_one({"id": unit_id})
    return {"ok": True}

@api.put("/units/{unit_id}")
async def update_unit(unit_id: str, payload: dict, current: dict = Depends(get_current_user)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.product_units.update_one({"id": unit_id}, {"$set": payload})
    return await db.product_units.find_one({"id": unit_id}, {"_id": 0})

@api.delete("/units/{unit_id}")
async def delete_unit_dup(unit_id: str, current: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------- Categories ----------
@api.get("/categories")
async def list_categories(current: dict = Depends(get_current_user)):
    return await db.categories.find({}, {"_id": 0}).to_list(500)

@api.post("/categories")
async def create_category(payload: dict, current: dict = Depends(get_current_user)):
    cat = Category(**payload).model_dump()
    await db.categories.insert_one(cat)
    cat.pop("_id", None)
    return cat


# ---------- Brands ----------
@api.get("/brands")
async def list_brands(current: dict = Depends(get_current_user)):
    return await db.brands.find({}, {"_id": 0}).to_list(500)

@api.post("/brands")
async def create_brand(payload: dict, current: dict = Depends(get_current_user)):
    brand = Brand(**payload).model_dump()
    await db.brands.insert_one(brand)
    brand.pop("_id", None)
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
    product.pop("_id", None)
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
    cust.pop("_id", None)
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
    sup.pop("_id", None)
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
        # If GST is disabled at bill level, force item GST to 0
        effective_gst_rate = 0.0 if not payload.gst_enabled else item.gst_rate
        base = (item.unit_price * item.quantity) - item.discount
        gst_amount = round(base * effective_gst_rate / 100, 2)
        line_total = round(base + gst_amount, 2)
        subtotal += base
        total_gst += gst_amount
        total_discount += item.discount
        computed_items.append({
            **item.model_dump(),
            "gst_rate": effective_gst_rate,
            "hsn_code": item.hsn_code or product.get("hsn_code", ""),
            "gst_amount": gst_amount, "line_total": line_total,
        })

    grand_total = round(subtotal + total_gst - payload.bill_discount, 2)
    total_discount += payload.bill_discount
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
        "gst_enabled": payload.gst_enabled,
        "bill_discount": payload.bill_discount,
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
# NOTE: The AI Insights feature (/api/ai/insights) has been removed here because
# it depended on Emergent's proprietary `emergentintegrations` package and
# EMERGENT_LLM_KEY, which only work inside the Emergent platform. If you want
# this feature back, it can be rebuilt using the public Anthropic API directly
# (pip install anthropic) with your own API key - just ask if you'd like this added.


# ---------- Seed Data ----------
async def seed_data():
    # Admin account only - created if it doesn't already exist.
    # This is the ONLY seeding that happens now. All demo categories, brands,
    # products, customers, suppliers, and sample sales have been permanently
    # removed (previously they were auto-recreated on every restart if their
    # collection was empty - that's what caused the "data keeps coming back"
    # issue). Add real data through the app UI or an import script instead.
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "id": new_id(), "email": admin_email, "name": "Laxmi Admin",
            "role": "super_admin",
            "password_hash": hash_password(os.environ["ADMIN_PASSWORD"]),
            "created_at": now_iso(),
        })


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