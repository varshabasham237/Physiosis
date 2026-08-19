# Physiosis — Supabase PostgreSQL Database & Authentication Setup

This document provides complete instructions for provisioning, configuring, and verifying the **Supabase** backend for the **Physiosis Rehabilitation Movement Engine**.

---

## 1. Create a Supabase Project

1. Navigate to [https://supabase.com/](https://supabase.com/) and sign in.
2. Click **New Project**.
3. Select your organization, choose a project name (e.g. `physiosis-rehab`), set a strong database password, and select the region closest to your users.
4. Wait ~1 minute for the project to finish provisioning.

---

## 2. Obtain Project URL and Anon API Key

1. In your Supabase Dashboard, go to **Project Settings** (gear icon in left sidebar) $\to$ **API**.
2. Copy the following keys:
   - **Project URL**: `https://<your-project-id>.supabase.co`
   - **Project API Keys** $\to$ `anon` / `public`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

> [!WARNING]
> **Never use or expose the `service_role` key in frontend code.** Only use the public `anon` key.

---

## 3. Configure Local Environment Variables

1. In the project root, copy the template file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in your actual Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Verify that `.env` is listed in `.gitignore` (already configured) so credentials are never committed.

---

## 4. Run SQL Migrations & Schema Setup

1. In your Supabase Dashboard, navigate to the **SQL Editor** (left navigation).
2. Click **New query**.
3. Open [`supabase/migrations/20260818_init_schema.sql`](file:///c:/Users/nirva/Physiosis/supabase/migrations/20260818_init_schema.sql).
4. Paste the entire SQL script and click **Run**.
5. The migration will automatically create:
   - `patient_login_seq` sequence & `generate_patient_login_id()` function (`PHS-100001`, `PHS-100002`, ...)
   - `public.profiles` table
   - `public.exercises` table with default seed rows (`SHOULDER_FLEXION`, `KNEE_EXTENSION`, `STRAIGHT_LEG_RAISE`)
   - `public.rehab_sessions` table
   - `public.session_reps` table
   - `public.movement_samples` table
   - `public.session_reports` table
   - `on_auth_user_created` trigger on `auth.users`
   - Row Level Security (RLS) policies on all tables
   - Performance indexes on foreign keys and timestamps.

---

## 5. Database Schema Architecture

```
                    ┌─────────────────────────┐
                    │       auth.users        │ (Supabase Auth)
                    └────────────┬────────────┘
                                 │ 1:1
                                 ▼
                    ┌─────────────────────────┐
                    │     public.profiles     │ (Patient Profiles)
                    │   id, patient_login_id  │ (e.g. PHS-100001)
                    └────────────┬────────────┘
                                 │ 1:N
         ┌───────────────────────┴───────────────────────┐
         ▼                                               ▼
┌──────────────────┐                            ┌──────────────────┐
│ public.exercises │                            │ rehab_sessions   │ (Completed Live Sessions)
│ 165°, 170°, 45°  │                            │ id, duration, rom│
└────────┬─────────┘                            └────────┬─────────┘
         │                                               │ 1:N
         │                                  ┌────────────┴────────────┐
         │                                  ▼                         ▼
         │                         ┌──────────────────┐      ┌──────────────────┐
         └────────────────────────►│  session_reps    │      │ session_reports  │
                                   │  peak, quality   │      │ summary, guidance│
                                   └──────────────────┘      └──────────────────┘
```

---

## 6. Authentication Flow

1. **Patient Registration (`Register.tsx`)**:
   - Patient enters Full Name, Email, Password, and optional Phone.
   - `authService.signUp()` registers the user via Supabase Auth.
   - The PostgreSQL trigger `handle_new_user()` creates a `public.profiles` record and assigns a sequential **Patient ID** (`PHS-100001`).
   - The UI presents the assigned Patient ID and redirects to the dashboard.
2. **Patient Login (`Login.tsx`)**:
   - Patient authenticates with Email + Password.
   - On success, `AuthContext` restores the authenticated session and loads the patient profile.
3. **Session Persistence**:
   - Supabase tokens are persisted in secure browser storage (`localStorage` / auth cookies).
   - Refreshing the page automatically restores the user state.
4. **Logout**:
   - Clears tokens, resets application state, and redirects to the Login screen.

---

## 7. Row Level Security (RLS) Policies

All tables containing patient data have Row Level Security enabled:

| Table | Operation | Policy Condition (`USING` / `WITH CHECK`) | Explanation |
|---|---|---|---|
| `profiles` | `SELECT`, `UPDATE` | `auth.uid() = auth_user_id` | Patient can only access/update their own profile. |
| `exercises` | `SELECT` | `true` (authenticated) | All authenticated users can view exercise reference targets. |
| `rehab_sessions` | `SELECT`, `INSERT` | `patient_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())` | Patient can only read and save their own sessions. |
| `session_reps` | `SELECT`, `INSERT` | `session_id IN (SELECT rs.id FROM rehab_sessions rs JOIN profiles p ON rs.patient_id = p.id WHERE p.auth_user_id = auth.uid())` | Repetition data is strictly isolated to the owning patient. |
| `session_reports` | `SELECT`, `INSERT` | `patient_id IN (SELECT id FROM profiles WHERE auth_user_id = auth.uid())` | Reports are private to the patient. |

---

## 8. How to Create and Verify Test Patients (Isolation Test)

To verify cross-patient data isolation:

### Test Patient A:
1. Open [http://localhost:3000/](http://localhost:3000/).
2. Click **Create Account**.
3. Register:
   - **Name**: `Alice Walker`
   - **Email**: `alice@test.physiosis.com`
   - **Password**: `TestPass123!`
4. Note assigned Patient ID (e.g. `PHS-100001`).
5. Perform a **Shoulder Flexion** session (e.g. 3 reps) and click **End Session**.
6. Verify the session appears in **History** and in **Recovery Trend**.
7. Click the top-right **Sign Out** button.

### Test Patient B:
1. Click **Create Account**.
2. Register:
   - **Name**: `Bob Smith`
   - **Email**: `bob@test.physiosis.com`
   - **Password**: `TestPass123!`
3. Note assigned Patient ID (e.g. `PHS-100002`).
4. Check **History** and **Recovery Trend**:
   - **Verified**: History is **empty** (0 sessions). Alice's sessions are completely hidden.
5. Perform a **Seated Knee Extension** session (e.g. 2 reps) and click **End Session**.
6. Verify only Bob's knee extension session is displayed.

---

## 9. Security Principles Applied

- **No Passwords in Application Tables**: Passwords never touch `public.profiles` or any custom table; they are hashed and stored exclusively within Supabase Auth (`auth.users`).
- **No Service-Role Key**: The frontend only uses the public `anon` key.
- **Backend Authorization Enforcement**: Row Level Security policies enforce ownership at the database level regardless of frontend parameters.
- **No Webcam Video / Camera Uploads**: Webcam frames are processed purely client-side in WebAssembly via MediaPipe. Only calculated movement angles and scores are transmitted.
- **Deterministic Demo Safety**: DEMO MODE sessions are never written to patient medical history.
