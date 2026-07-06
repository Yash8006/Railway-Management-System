# 🚂 Railway Management System (RMS)

A **production-grade, full-stack railway ticketing and management platform** built with Node.js, Express, MongoDB, and React + Vite.

![RMS Banner](https://img.shields.io/badge/Stack-Node.js%20%7C%20React%20%7C%20MongoDB-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ Features

### 🎫 Passenger Features
- **Train Search** — Search by station code, date, class, and train type
- **Smart Seat Allocation** — Groups passengers by cabin → coach → train; prioritizes lower berths for seniors (age ≥ 60) and disabled passengers
- **ACID Booking** — MongoDB transactions prevent double-booking under concurrent load
- **Dynamic Fare Engine** — Base fare + distance + class multiplier + Tatkal premium + occupancy-based dynamic pricing
- **PDF Tickets** — Download Electronic Reservation Slips (ERS) as PDF
- **Booking Cancellation** — Time-based refund rules (100% → 50% → 0%) with auto-wallet credit
- **RAC/Waitlist** — Automatic promotion when confirmed passengers cancel
- **RMS Wallet** — In-app balance for instant payments and refunds
- **Co-Passengers** — Save frequent travellers for one-click import at checkout
- **Live Tracking** — Real-time train status, delay alerts, platform numbers
- **Notifications** — In-app, email, and SMS alert inbox

### ⚙️ Admin Features
- **Station Registry** — Full CRUD for stations with geo-coordinates
- **Route Management** — Define stops, distances, and halt times
- **Train Management** — Configure coaches, berth layout, and class types
- **Schedule Engine** — Daily/weekly/custom frequency schedules → instantiate seat inventories
- **Analytics Dashboard** — Revenue by class/quota, occupancy heatmap, age demographics, low-occupancy alerts

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    React + Vite Frontend                    │
│           (Port 5173 → proxied to :5001 via Vite)          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP / REST API
┌──────────────────────────▼──────────────────────────────────┐
│           Node.js + Express Backend (Port 5001)             │
│                                                             │
│  Routes → Middleware (JWT) → Controllers → Mongoose → DB   │
└──────────────────────────┬──────────────────────────────────┘
                           │ Mongoose ODM
┌──────────────────────────▼──────────────────────────────────┐
│                      MongoDB Atlas / Local                   │
│   9 Collections: Users, Stations, Routes, Trains,           │
│   Schedules, ScheduledRuns, Bookings, Notifications,        │
│   LiveStatus                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose | Why This |
|---|---|---|
| **Node.js + Express** | REST API server | Lightweight, full ecosystem control |
| **MongoDB + Mongoose** | Database + ODM | Nested documents (coaches in Train) eliminate JOINs |
| **JWT (jsonwebtoken)** | Authentication | Stateless — no server-side session storage |
| **bcryptjs** | Password hashing | Pure-JS bcrypt, no OS build tools needed |
| **PDFKit** | PDF ticket generation | Streams directly to HTTP response |
| **dotenv** | Config management | 12-factor app secret management |

### Frontend
| Technology | Purpose | Why This |
|---|---|---|
| **React 19** | UI components | Industry standard component model |
| **Vite** | Build tool + dev server | <50ms HMR, ESM-native, CRA replacement |
| **React Router v7** | Client-side routing | SPA navigation without full page reloads |
| **Axios** | HTTP client | Interceptors for auto JWT-attachment |
| **Vanilla CSS + Variables** | Styling | Zero runtime cost, true design token system |
| **Context API** | Global state | Auth + toasts — no Redux overhead needed |

---

## 📁 Project Structure

```
Railway Management System/
├── backend/
│   └── src/
│       ├── config/         # DB connection
│       ├── controllers/    # Business logic (booking, search, payment, etc.)
│       ├── models/         # 9 Mongoose schemas
│       ├── routes/         # 8 Express routers
│       ├── middleware/      # JWT auth, role-based access
│       ├── services/       # Notification service
│       └── server.js       # Express app entry
├── Frontend/
│   └── src/
│       ├── api/            # All API functions (Axios)
│       ├── context/        # AuthContext + ToastContext
│       ├── components/     # Navbar, ProtectedRoute
│       ├── pages/          # 11 full page components
│       └── index.css       # Design system (CSS variables)
└── package.json            # Workspace scripts
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas URI)

### 1. Clone the repo
```bash
git clone https://github.com/Yash8006/Railway-Management-System.git
cd "Railway Management System"
```

### 2. Set up Backend Environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB URI, JWT_SECRET, PORT
```

### 3. Install & Run Backend
```bash
cd backend
npm install
npm run dev       # Starts on http://localhost:5001
```

### 4. Install & Run Frontend
```bash
cd Frontend
npm install
npm run dev       # Starts on http://localhost:5173
```

### 5. Open the App
Navigate to **http://localhost:5173**

---

## 📡 API Endpoints

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/users/register` | Register new user |
| POST | `/api/users/login` | Login, returns JWT |
| GET | `/api/users/profile` | Get logged-in user |
| PUT | `/api/users/profile` | Update profile |

### Booking
| Method | Route | Description |
|---|---|---|
| GET | `/api/bookings` | All user bookings |
| POST | `/api/bookings` | Create booking (ACID transaction) |
| POST | `/api/bookings/:id/cancel` | Cancel + auto-refund |
| GET | `/api/bookings/:id/download` | Download PDF ticket |
| GET | `/api/bookings/:id/refund-preview` | Refund preview before cancellation |

### Search
| Method | Route | Description |
|---|---|---|
| GET | `/api/search/trains` | Search by from, to, date, class |
| GET | `/api/search/connected-journeys` | Multi-hop connected journey planner |
| GET | `/api/search/seat-availability` | Check seat availability |

### Payment
| Method | Route | Description |
|---|---|---|
| GET | `/api/payment/fare` | Dynamic fare calculation |
| POST | `/api/payment/checkout-session` | Create checkout session |

### Admin (Role: admin)
| Method | Route | Description |
|---|---|---|
| GET/POST/PUT/DELETE | `/api/admin/stations` | Station CRUD |
| GET/POST/PUT/DELETE | `/api/admin/routes` | Route CRUD |
| GET/POST/PUT/DELETE | `/api/admin/trains` | Train CRUD |
| GET/POST/DELETE | `/api/admin/schedules` | Schedule CRUD |
| POST | `/api/admin/schedules/:id/instantiate` | Generate scheduled runs |
| GET | `/api/admin/analytics/sales` | Sales analytics |
| GET | `/api/admin/analytics/occupancy` | Occupancy analytics |
| GET | `/api/admin/analytics/demographics` | Demographics analytics |

---

## 🔑 Key Engineering Decisions

### 1. MongoDB ACID Transactions for Seat Booking
The entire seat reservation happens inside `session.startTransaction()`. If two passengers attempt to book the same seat simultaneously, the second transaction will fail gracefully. **Redis locks were rejected** as they add external infrastructure.

### 2. Interval Overlap Math for Seat Availability
```
Math.max(qStart, seg.fromIndex) >= Math.min(qEnd, seg.toIndex)
```
A seat booked A→B is automatically available for B→D with no relational table needed.

### 3. 3-Tier Berth Allocation
1. Same **cabin** (bay) → 2. Same **coach** → 3. Anywhere on **train**
Lower berths auto-assigned first for seniors (age ≥ 60) or disabled passengers.

### 4. Dynamic Pricing
`fare = baseFare + (distanceKm × 0.5) × classMultiplier × quotaMultiplier × dynamicPricingMultiplier`

Where `dynamicPricingMultiplier` ramps to 1.5× when occupancy exceeds 80%.

---

## 📄 License

MIT © [Yash8006](https://github.com/Yash8006)
