# 🔧 FixoN – On-Demand Home Services Platform

> A full-stack home services platform connecting customers with verified local workers (electricians, plumbers, carpenters, etc.)

---

## 📱 Screenshots

| Customer App | Worker App | Admin Panel |
|---|---|---|
| Book services on-demand | Accept & manage jobs | Full control dashboard |

---

## 🚀 Features

### 👤 Customer Mobile App (Flutter)
- Browse and book home services (electrical, plumbing, carpentry, etc.)
- Real-time worker assignment based on location
- Live booking status tracking
- In-app chat with assigned worker
- Booking history and reviews

### 👷 Worker Mobile App (Flutter)
- Receive and accept/reject booking requests
- Before & after photo uploads for completed jobs
- Earnings dashboard
- Profile and verification management

### 🖥️ Admin Control Panel (React.js)
- Manage all services, categories, and pricing
- Real-time booking monitoring dashboard
- Worker verification and management
- Customer management
- Analytics and reports
- Coupon/discount management

### ⚙️ Backend (Node.js + Express)
- RESTful API architecture
- MongoDB Atlas cloud database
- Real-time data sync between admin panel and mobile apps
- Worker location-based assignment logic
- Secure authentication system
- Deployed on Render (cloud)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | Flutter, Dart |
| Admin Panel | React.js |
| Backend | Node.js, Express.js |
| Database | MongoDB, MongoDB Atlas |
| Deployment | Render (Cloud) |
| Authentication | JWT |

---

## 👥 Team

| Name | Role |
|---|---|
| Varun | Backend (Node.js, Express, MongoDB) + Admin Panel (React.js) |
| Navya | Mobile Apps (Flutter – Customer & Worker App) |

---

## 📦 Project Structure

```
FixoN/
├── server.js          # Main backend server
├── src/               # React.js Admin Panel
├── mobile_app/        # Flutter Customer App
├── worker_app/        # Flutter Worker App
├── public/            # Static assets
└── package.json       # Node.js dependencies
```

---

## ⚡ Getting Started

### Backend
```bash
npm install
node server.js
```

### Admin Panel
```bash
npm run dev
```

### Mobile App
```bash
cd mobile_app
flutter pub get
flutter run
```

---

## 🌐 Live Demo
- Backend API: [Deployed on Render](https://fixon-backend.onrender.com)

---

## 📄 License
This project is for educational/portfolio purposes.
