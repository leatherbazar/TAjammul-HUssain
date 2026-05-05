╔══════════════════════════════════════════════════════════════════╗
║           TATAHEER ERP 2026 — SETUP GUIDE                       ║
║           Tataheer Business Group                                ║
╚══════════════════════════════════════════════════════════════════╝

STEP 1 — Install Node.js (ONE TIME ONLY)
─────────────────────────────────────────
Download from: https://nodejs.org/en/download
Choose the "LTS" version for Windows.
Install with default settings.

STEP 2 — Add Your Logo (OPTIONAL)
─────────────────────────────────
Copy your company logo image to:
  public\logo.png
(The attached TAT logo — save it as logo.png inside the "public" folder)

STEP 3 — Launch the ERP
────────────────────────
Double-click:  START_ERP.bat

The browser will open automatically at http://localhost:3000

STEP 4 — Login Credentials
────────────────────────────
🛡️  ADMIN LOGIN:
    Username: admin
    Password: admin123
    (Change via Settings → User Management → Security)

👷  EMPLOYEE LOGIN:
    Create employees from Admin → User Management

🤝  CLIENT LOGIN:
    Clients can self-register on the login page

MASTER CODE (for Edit/Delete):  5555
(Change anytime from Admin → User Management → Security)

──────────────────────────────────────────────────────
MODULES AVAILABLE:
──────────────────────────────────────────────────────
📊  Dashboard          — KPI cards, wallets, charts
📅  Calendar           — Events, notes, reminders
📋  Quotations         — Full quotes with size/color matrix
🛒  Supply Orders      — Market feed for employees
🚚  Delivery Notes     — Dispatch management
🧾  Invoices           — Starting from #201
📦  Inventory          — Stock with SKU tracking
💰  Finance            — Day Book, advances, wallets
🤝  Client Requests    — Admin queue for client orders
👥  User Management    — Employees, clients, security
⚙️  Settings           — Backup, invoice counter

──────────────────────────────────────────────────────
SECURITY FEATURES:
──────────────────────────────────────────────────────
• Master Code 5555 required for ALL edit/delete actions
• Admin can change master code anytime
• Three separate portals (Admin / Employee / Client)
• Client portal: sees only their own data and target prices
• Employee portal: sees only assigned supply orders

──────────────────────────────────────────────────────
DATA STORAGE:
──────────────────────────────────────────────────────
All data is stored in your browser's localStorage.
Use Settings → Export Backup to save a JSON backup file.
Data persists between sessions automatically.

Support: tataheertraders@gmail.com
