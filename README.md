# PocketLog

> **Modern Personal Finance, Payday Budgeting & PWA Financial Vault**  
> Built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, and Supabase (PostgreSQL with Row Level Security).

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_RLS-3ecf8e?logo=supabase)](https://supabase.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-purple?logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
  - [1. Dynamic Payday Budget Cycles](#1-dynamic-payday-budget-cycles)
  - [2. Dual-Layer Accounts & Envelope Pockets](#2-dual-layer-accounts--envelope-pockets)
  - [3. Transaction Ledger & Cash Flow Isolation](#3-transaction-ledger--cash-flow-isolation)
  - [4. Debts & Receivables with Automatic Capital Restoration](#4-debts--receivables-with-automatic-capital-restoration)
  - [5. Multi-Asset Investment Portfolio Tracker](#5-multi-asset-investment-portfolio-tracker)
  - [6. Financial Analytics & Balance Wave Charts](#6-financial-analytics--balance-wave-charts)
  - [7. Excel Engine (Export, In-App Viewer & Import)](#7-excel-engine-export-in-app-viewer--import)
  - [8. Web Push Notifications & Daily Cron Reminders](#8-web-push-notifications--daily-cron-reminders)
  - [9. Multi-Tier Security & Trusted Device Gate](#9-multi-tier-security--trusted-device-gate)
  - [10. Complete Database Backup & Superadmin Tools](#10-complete-database-backup--superadmin-tools)
  - [11. 100% Mirroring Guest Demo Mode](#11-100-mirroring-guest-demo-mode)
  - [12. Progressive Web App (PWA)](#12-progressive-web-app-pwa)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running the App](#running-the-app)
- [Automated Cron Reminders Setup](#automated-cron-reminders-setup)
- [PWA Installation Guide](#pwa-installation-guide)
- [Docker Deployment](#docker-deployment)
- [License](#license)

---

## Overview

**PocketLog** is a full-featured personal finance management platform and Progressive Web App (PWA). It is designed to match how people actually manage their money in daily life.

Traditional budgeting apps force transactions into rigid 1st-to-30th calendar months. PocketLog introduces a **Payday Cycle Engine** that adapts to your actual salary or cash flow schedule (for example, the 25th of one month to the 24th of the next). 

It combines envelope budgeting, automatic capital restoration on debt repayments, multi-asset investment tracking, in-app Excel generation and viewing, daily Web Push reminders, and a secure multi-tier authentication gate.

It also includes a **zero-configuration Guest Demo Mode** that completely mirrors all features and database workflows in local browser storage, allowing anyone to explore the app safely.

---

## Key Features

### 1. Dynamic Payday Budget Cycles
- **Custom Payday Schedule**: Choose any day of the month as your recurring cycle start date (e.g. the 25th).
- **Automatic Budget Windows**: The app recalculates budget limits, daily spending velocity, and remaining balances based on your active cycle instead of rigid calendar months.
- **Historical Cycle Archives**: Past cycles are automatically tracked and archived so you can compare month-over-month performance.

### 2. Dual-Layer Accounts & Envelope Pockets
- **Real Accounts**: Track real physical or digital repositories (Bank Accounts, Cash, E-Wallets).
- **Sub-Account Pockets**: Allocate funds to specific spending goals or envelopes (e.g. Living & Bills, Daily Meals, Savings).
- **Off-Budget Asset Protection**: Flag accounts like Emergency Funds or Long-Term Savings as `include_in_budget: false`. They stay part of your total net worth without distorting your monthly spending limits.
- **Top-Up Transfers**: Move money between internal accounts or pockets without registering false income or expense records.

### 3. Transaction Ledger & Cash Flow Isolation
- **Transaction Types**: Supports **Expense**, **Income**, and **Transfer**.
- **Transfer Isolation**: Internal transfers balance your accounts without inflating revenue or spending totals.
- **Advanced Filtering**: Quickly filter transactions by category, account, type, and date range.
- **Responsive Layout**: Table view on desktop screens and clean, infinite-scrolling card view on mobile.

### 4. Debts & Receivables with Automatic Capital Restoration
- **Payables ("I Owe")**: Track liabilities, loan sources, due dates, and repayment progress.
- **Receivables ("They Owe")**: Track money lent to friends, family, or clients with due dates.
- **Automatic Capital Restoration**: When you lend money from an account and later mark the receivable as "Paid", PocketLog automatically creates an income transaction that restores the funds back to your source account. If reopened, it reverses the transaction cleanly.

### 5. Multi-Asset Investment Portfolio Tracker
- **Asset Classes**: Monitor Mutual Funds, Stocks, Bonds / SBN, Crypto, Gold, and Time Deposits.
- **Real-Time Portfolio Valuation**: Track invested capital, current market value, unrealized capital gains/losses, and returns percentage.
- **Investment Activity Logs**: Record initial investments, top-ups, dividend/coupon payouts, and partial or full redemptions.

### 6. Financial Analytics & Balance Wave Charts
- **Interactive Balance Wave**: Visual curve showing balance movements and cash flow trajectory over time.
- **Spending Distribution**: Interactive breakdowns of spending by category and by pocket.
- **Budget Gauges**: Visual indicators showing remaining cycle budget and daily recommended spending limits.

### 7. Excel Engine (Export, In-App Viewer & Import)
- **Comprehensive Excel Export**: Generates a professional 11-sheet formatted `.xlsx` workbook containing your financial summary, category breakdowns, complete transaction ledger, active debts, and investment portfolio.
- **In-App Spreadsheet Viewer**: Inspect multi-sheet workbooks directly in your browser with sticky headers, search, and sheet switching—no desktop software required.
- **Data Import**: Ingest past transactions and account records from Excel or JSON templates with automatic duplicate detection.

### 8. Web Push Notifications & Daily Cron Reminders
- **Native Web Push**: Sends push notifications directly to desktop browsers, Android devices, and iOS Home Screen web apps.
- **Daily Expense Reminder**: Alerts you in the evening (20:00 WIB / 13:00 UTC) only if you have not logged any expenses for the current day.
- **Due Date Alerts**: Automatically notifies you on the day a debt payment or receivable is due.
- **Vercel Cron Integration**: Runs automatically once per day via `/api/cron/reminders` without complex server infrastructure.
- **Test Notifications**: In-app one-click test button to verify push delivery immediately.

### 9. Multi-Tier Security & Trusted Device Gate
- **Server-Side Authentication Gate**: Enforced on initial Server-Side Rendering (SSR) before page hydration. Unauthenticated requests are redirected immediately.
- **Trusted Device Verification**: Pair new hardware or browsers using a secure `TRUSTED_DEVICE_TOKEN` query parameter.
- **Brute-Force Protection**: Tracks failed PIN attempts with progressive cooldown lockouts (15 minutes) and 5-minute inactivity session expiration.
- **Zero Secrets Hardcoded**: All session tokens use HMAC-SHA256 derivation with environment-driven keys.

### 10. Complete Database Backup & Superadmin Tools
- **Full Database Dumps**: Superadmin users can export complete database backups in structured JSON and PostgreSQL SQL dump formats.
- **Restore Capability**: Import database dumps to restore complete financial histories across all tables.
- **Multi-User Management**: Superadmins can add users, manage roles, and reset security PINs directly from the UI.

### 11. 100% Mirroring Guest Demo Mode
- **Zero Setup Required**: Click "Enter Demo Mode" on the login screen to test the full application immediately.
- **Full Feature Parity**: Create transactions, edit categories, view charts, test notifications, and export Excel files inside an isolated `sessionStorage` sandbox.
- **Safe Evaluation**: Zero writes to production databases; refreshes cleanly whenever desired.

### 12. Progressive Web App (PWA)
- **Standalone Mobile Experience**: Runs fullscreen without browser address bars on iOS and Android.
- **Safe-Area Inset Support**: Automatically adapts padding for camera notches and device navigation bars.
- **Offline Cache**: Local cache ensures key views and data remain accessible even during network drops.

---

## Tech Stack

| Layer | Technology | Usage in PocketLog |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | React Server Components (RSC), Server Actions, dynamic API route handlers |
| **Frontend** | React 19 & TypeScript 5 | Strict typing, optimistic UI updates, and modern hooks |
| **Styling** | Tailwind CSS v4 | Dark mode canvas, CSS variables, and responsive layout primitives |
| **Database** | Supabase (PostgreSQL 15) | Relational schema, Row Level Security (RLS) tenant isolation |
| **Spreadsheets** | ExcelJS | Client & server multi-sheet `.xlsx` generation and parsing |
| **Charts** | Recharts | Balance wave curves, spending distribution, and budget gauges |
| **Push Notifications** | Web Push & Service Workers | Native web push notifications with VAPID key authentication |
| **Security** | Web Crypto & HMAC-SHA256 | HttpOnly session cookies, PIN verification, trusted device tokens |
| **Container** | Docker & Alpine Linux | Multi-stage production container image |

---

## Project Structure

```
pocket-log/
├── app/
│   ├── (app)/                          # Application routes (Auth & Demo)
│   │   ├── accounts/                   # Accounts, wallets & envelope pockets
│   │   ├── categories/                 # Expense & income budget categories
│   │   ├── debts/                      # Payables & receivables tracker
│   │   ├── import-export/              # Excel export, import, closing & in-app viewer
│   │   ├── investments/                # Portfolio tracking & valuation history
│   │   ├── profile/                    # Profile settings, PIN & security credentials
│   │   ├── reports/                    # Income/expense analytics & trend charts
│   │   ├── transactions/               # Searchable ledger with multi-criteria filters
│   │   ├── users/                      # Superadmin user management & PIN provisioning
│   │   ├── layout.tsx                  # Server layout with SSR auth gating
│   │   └── page.tsx                    # Executive dashboard (KPI cards & balance wave)
│   ├── (auth)/login/                   # Login screen, PIN pad & demo entry
│   ├── api/
│   │   ├── admin/database-backup/      # Superadmin full database JSON/SQL backup
│   │   ├── auth/me/                    # Session status verification endpoint
│   │   ├── cron/reminders/             # Daily reminder cron job handler
│   │   ├── data/sync/                  # Data synchronization for auth & demo users
│   │   └── notifications/              # Push subscription & test push endpoints
│   ├── globals.css                     # Design tokens & Tailwind CSS v4 imports
│   ├── layout.tsx                      # Root HTML layout and viewport setup
│   └── manifest.ts                     # PWA web app manifest
├── components/
│   ├── auth/                           # Security gate and lockout dialogs
│   ├── dashboard/                      # Balance wave chart, gauges, KPI summaries
│   ├── excel/                          # In-app Excel spreadsheet modal viewer
│   ├── layout/                         # Desktop header, sidebar & mobile bottom bar
│   ├── modals/                         # Modals for transactions, pockets, and cycles
│   ├── notifications/                  # Push notification permission card
│   └── ui/                             # Reusable buttons, badges, selects, and inputs
├── lib/
│   ├── auth/                           # HMAC-SHA256 session crypto & trusted device logic
│   ├── data/DataContext.tsx           # Global state, optimistic mutations & offline storage
│   ├── demo/demo-data.ts               # Demo dataset for sandbox exploration
│   ├── excel/                          # ExcelJS workbook generator, parser & previewer
│   ├── notifications/                  # Web Push client and storage adapters
│   ├── supabase/                       # Server, browser & middleware Supabase clients
│   └── calculations.ts                 # Domain math (cycles, balances, debt reconciliation)
├── public/
│   ├── sw.js                           # Service worker for offline assets & push alerts
│   └── icons/                          # PWA icons for mobile screens
├── supabase/
│   └── migrations/                     # PostgreSQL schema, RLS policies, and triggers
├── vercel.json                         # Vercel Cron schedule configuration
└── Dockerfile                          # Multi-stage production container setup
```

---

## Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **Package Manager**: `npm`, `pnpm`, or `yarn`
- **Database (Optional for Demo Mode)**: A free [Supabase](https://supabase.com) PostgreSQL database

---

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/geedotrar/pocket-log.git
   cd pocket-log
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

---

### Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

Configure your variables in `.env`:

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (for live DB) | Your Supabase project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes (for live DB) | Your Supabase publishable or anon key | `sbp_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Supabase service role key for Superadmin global database backups | `eyJ...` |
| `TRUSTED_DEVICE_TOKEN` | Recommended | Secret token for pairing trusted devices via `?device=TOKEN` | `your-secure-device-token` |
| `SESSION_SECRET` | Recommended | Secret string used for HMAC-SHA256 session token signatures | `your-random-secret-key` |
| `SESSION_EXPIRATION_SECONDS` | Optional | Session duration in seconds or time shorthand | `86400` (1 day) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | Public VAPID key for Web Push notifications | `BEl...` |
| `VAPID_PRIVATE_KEY` | Optional | Private VAPID key for Web Push notifications | `secret...` |
| `VAPID_SUBJECT` | Optional | Contact email or URL for push service identification | `mailto:admin@pocketlog.app` |
| `CRON_SECRET` | Optional | Secret token protecting the `/api/cron/reminders` endpoint | `your-cron-secret-token` |
| `NEXT_PUBLIC_APP_NAME` | Optional | Custom application name displayed in the UI | `PocketLog` |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | Optional | Default currency code for formatting | `IDR` or `USD` |

> **Tip for generating VAPID keys:**
> You can generate VAPID keys easily using `npx web-push generate-vapid-keys`.

---

### Database Setup

If you are using a live Supabase project, execute the consolidated schema migration in your **Supabase SQL Editor**:

- `supabase/migrations/20261028000000_init.sql` — Initializes all 11 tables, composite indexes, Row Level Security (RLS) policies, and authentication stored procedures.

---

### Running the App

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- To explore without a database, click **"Enter Demo Mode"** on the login screen.
- To pair a trusted device on first run, append your token to the URL: `http://localhost:3000/login?device=your-trusted-device-secret-token`.

---

## Automated Cron Reminders Setup

PocketLog includes an automated daily reminder service deployed via Vercel Cron.

### Schedule
- **Trigger**: Every day at **13:00 UTC** (**20:00 WIB / 8:00 PM**).
- **Configuration** in `vercel.json`:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/reminders",
        "schedule": "0 13 * * *"
      }
    ]
  }
  ```

### What It Checks
1. **Daily Expense Reminder**: Sends a reminder if you have not logged any expense for the current day.
2. **Due Date Alert**: Sends an alert if you have debts to pay (`i_owe`) or receivables to collect (`they_owe`) that are due today or overdue.

### Manual Verification
You can manually trigger and test the reminder endpoint:

```bash
# Using Authorization Header:
curl -H "Authorization: Bearer your-cron-secret-token" https://your-domain.com/api/cron/reminders

# Or using query parameter in browser:
https://your-domain.com/api/cron/reminders?key=your-cron-secret-token
```

---

## PWA Installation Guide

PocketLog works as an installable Progressive Web App (PWA):

### On iOS (iPhone / iPad)
1. Open the app in **Safari**.
2. Tap the **Share** button (box with an upward arrow) in the toolbar.
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top right corner.
5. Open PocketLog from your Home Screen to enable fullscreen standalone mode and push notifications.

### On Android
1. Open the app in **Google Chrome**.
2. Tap the three-dot menu `⋮` in the top right corner (or click the "Install App" banner at the bottom).
3. Select **"Install app"** or **"Add to Home screen"**.
4. Open the installed app from your home screen or app drawer.

---

## Docker Deployment

To build and run PocketLog in a container:

```bash
# Build and run with Docker Compose
docker compose up --build -d
```

The application will be accessible at `http://localhost:3000`.

---

## License

This project is licensed under the [MIT License](LICENSE).
