# Complete Feature Specification: Railway Management System (RMS)

This document outlines the complete list of features and functional specifications required to build a production-grade, state-of-the-art Railway Management System.

---

## 1. User Account & Profile Management
* **Role-Based Access Control (RBAC):**
  * **Passenger:** Search trains, check availability, book/cancel tickets, track history, manage profile.
  * **Admin:** Full CRUD operations on trains, stations, routes, schedules, fares, and user accounts.
  * **Station Master / Operator:** Update live train running status, manage delays, and assign platform numbers.
* **Authentication Options:**
  * Secure Sign-Up / Sign-In with JWT.
  * OAuth2 Integration (Google, GitHub) for fast passenger login.
  * Multi-Factor Authentication (MFA) for Admin roles.
* **Passenger Dashboard:**
  * **Saved Co-Passengers:** Store frequently traveling family/friends details (Name, Age, Gender, ID Proof) for quick checkout during booking.
  * **Booking History:** Access past and upcoming tickets, download PNR tickets in PDF format.
  * **RMS Wallet:** In-app digital wallet for instant refunds on cancellations, which can be reused for future bookings.

---

## 2. Train, Route & Station Management (Admin Console)
* **Station Registry:**
  * Add, update, or remove stations with station codes, city names, coordinate data, and zone classifications.
* **Route Builder:**
  * Define complex multi-stop routes (e.g., Train X stops at A -> B -> C -> D).
  * Set sequential stop orders, arrival times, departure times, and cumulative distances between stops.
* **Train Configurator:**
  * Add trains with unique train numbers and names.
  * **Coach Layout Mapping:** Configure classes (Sleeper, AC 3 Tier, AC 2 Tier, First Class) and layout blueprints (number of coaches, seat numbering, berth types: Lower, Middle, Upper, Side Lower, Side Upper).
* **Schedule Engine:**
  * Define running frequency (Daily, Weekly on specific days, or custom date ranges).
  * Automatically instantiate seat configurations for scheduled runs on upcoming dates.

---

## 3. Advanced Search & Routing Engine
* **Direct Search:**
  * Query trains between source and destination stations on a chosen date.
  * Filter results by Class, Depature/Arrival time window, and Train Type (Express, Passenger, Superfast).
* **Indirect / Connected Journey Planner:**
  * Graph-based search to suggest connecting journeys when no direct trains exist (e.g., Train 1 from Station A -> B, followed by Train 2 from Station B -> C).
* **Live Seat Availability Engine:**
  * Real-time query showing exact seat numbers and count remaining for any given train segment (handling multi-stop overlaps, e.g. a seat booked from A -> B is shown as vacant for B -> D).

---

## 4. Ticketing & Booking Core Engine
* **Concurrent Booking Prevention:**
  * Lock-free atomic reservation or transactional seat reservation using MongoDB sessions. Ensures no two passengers can book the same physical seat at the same time.
* **Berth Auto-Allocation Algorithm:**
  * Allocate lower berths to senior citizens or disabled passengers automatically.
  * Group family members/group bookings together in the same cabin or coach whenever possible.
* **PNR Generation & Quota Handling:**
  * Generate a unique 10-digit Passenger Name Record (PNR).
  * Manage booking quotas: General (GN), Tatkal (immediate/premium), Ladies (LD), and Senior Citizen (SR).
* **Waitlist (WL) & Reservation Against Cancellation (RAC) Engine:**
  * Implement queuing logic. When a confirmed ticket is cancelled, the first RAC ticket is upgraded to Confirmed, and the first Waitlisted ticket moves to RAC.

---

## 5. Live Tracking & Status Reporting
* **Live Running Status:**
  * Display where the train is currently, the last crossed station, delay status (e.g., "Late by 15 mins"), and estimated time of arrival (ETA) at upcoming stations.
* **Platform Number Locator:**
  * Track and display historical or real-time platform numbers at major stops.
* **Emergency Alerts:**
  * Flag schedule revisions, train diversions, or cancellations due to weather or maintenance issues.

---

## 6. Payment, Fare Calculation & Refund Policies
* **Dynamic Fare Calculation:**
  * Base Fare + Distance-based charge + Class surcharge + Quota charge (e.g., Tatkal charge).
  * Dynamic pricing option (fare increases as seat occupancy approaches 100%).
* **Payment Integration:**
  * Support for UPI, Credit/Debit cards, Net Banking, and RMS Wallet via Stripe / Razorpay API.
* **Refund Rules Engine:**
  * Automated refund deductions based on time remaining before departure:
    * *Cancel > 48 hours:* 10% flat charge.
    * *Cancel 12 to 48 hours:* 25% charge.
    * *Cancel 4 to 12 hours:* 50% charge.
    * *Cancel < 4 hours:* No refund.

---

## 7. Automated Notification System
* **SMS / Email Alerts:**
  * Immediate dispatch of PDF ticket and PNR details on successful booking.
  * Auto-notification on waitlist progression (e.g., "WL 5 upgraded to Confirmed").
  * Alerts in case of delays or cancellations.
* **In-App Notifications:**
  * Push alerts for upcoming journeys.

---

## 8. Admin Analytics & Reporting Dashboard
* **Sales Analytics:**
  * Daily, weekly, and monthly revenue charts.
  * Breakdown of bookings per class and booking quotas.
* **Occupancy Analytics:**
  * Identify most profitable routes, peak hours, and low-occupancy trains to optimize operations.
* **User Demographics:**
  * Insights into passenger age groups and booking trends.
