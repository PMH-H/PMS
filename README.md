chec
  <div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  </div>

  # PharmAI

  This repository contains the full source code for **PharmAI**, a comprehensive, AI-powered pharmacy management platform demonstrated in Gemini AI Studio.

  View the app specification in AI Studio: https://ai.studio/apps/drive/1niVkh1MXmWNtBNV_mw6eqJzWUPPfhpzM

  ## Features

  *   **Role-Based Dashboards:** Tailored interfaces for Patients, Pharmacists, Admins (Shop Owners), and Developers.
  *   **AI-Powered POS:** A smart Point-of-Sale system with barcode scanning, manual entry, and AI-driven prescription analysis.
  *   **Inventory Management:** Tools for stock control, batch tracking, reconciliation, and procurement suggestions.
  *   **User Management:** Secure signup, profile management, and a special interface for developers to create admin accounts.
  *   **Business Intelligence:** Dashboards for analyzing sales, inventory, and customer behavior trends.
  *   **Comprehensive Auditing:** Full audit trail for critical actions, ensuring accountability and tracking.
  *   **Secure by Design:** Leverages PostgreSQL's Row Level Security (RLS) to enforce strict data access policies.
  *   **User Feedback System:** Enables users to submit feedback and bug reports directly through the application.

  ## Progress

  ### Implemented

  *   **Role-Based Dashboards:** Basic dashboards for Patients, Pharmacists, Admins, Super Admins and Developers are in place.
  *   **User Management:** User signup, login, and profile management are functional.
  *   **Real-time Notifications:** Real-time updates for prescriptions, alerts, and inventory.
  *   **Chat Assistant:** An AI-powered chat assistant is available for non-patient roles.
  *   **Profile Settings:** Users can update their profiles.
  *   **Point-of-Sale:** Basic functionality for processing sales and updating prescriptions.
  *   **Inventory Management:** Viewing inventory and stock levels.


  ### Completed Phases
  *   **Phase 1-3:** Core Dashboards, User Management, Inventory.
  *   **Phase 4 (Store):** Digital commerce, Cart, Checkout, Dispatch.
  *   **Phase 5 (Prescriber):** Prescriber Dashboard, Patient Search, e-Prescribing with Formulary checks.
  *   **Phase 6 (Network):** Multi-tenant Inventory, Hierarchy, Stock Transfers.
  *   **Phase 7 (Analytics):** Super Admin BI, AI Forecasting (Gemini), Market Reports.
  *   **Phase 10 (Security):** System hardening, RLS Audit, Schema Zoning.

  ## Directory Structure

  ```
  .
  ├── src/                # Frontend Source Code (React/Vite)
  ├── supabase/           # Backend Logic
  │   ├── functions/      # Edge Functions (Deno/TS)
  │   ├── migrations/     # Database Migrations (SQL)
  │   └── scripts/        # Utility SQL Scripts (Audit, Debug, QA)
  ├── docs/               # Project Documentation
  │   └── references/     # External References (PDFs, Excel data)
  └── ...
  ```

  ## Documentation
  Detailed documentation can be found in the `docs/` folder.
  *   [Developer Reference](docs/DEVELOPER_REFERENCE.md)
  *   [Backend Architecture](docs/backend.md)
  *   [Integration Guide](docs/INTEGRATION_GUIDE.md)

