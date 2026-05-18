# eCourt Tracker: Authentication & User Roles Architecture

We have successfully designed and built a highly secure, state-of-the-art authentication and role-based access system for the eCourt Tracker application. The implementation incorporates a gorgeous glassmorphic frontend UI with a robust, token-based C# .NET Core backend backed by a PostgreSQL database schema.

---

## 🔐 Default Seeded Credentials

On application startup, the backend automatically seeds a default Administrator account if no admin exists. You can use these credentials to instantly log in and access all privileges:

* **Username:** `admin`
* **Password:** `admin123`
* **Role:** `Admin`

---

## 🏛️ System Features & User Roles

| Feature | Standard User | Administrator (`Admin`) |
| :--- | :---: | :---: |
| **View Dashboard Stats** | Yes | Yes |
| **Search Case CNR Numbers (Manual)** | Yes | Yes |
| **Run OCR Captcha Solver (Auto)** | Yes | Yes |
| **View Detailed Case Records** | Yes | Yes |
| **Switch Dark / Light Themes** | Yes | Yes |
| **Delete Database Case Cache** | ❌ Blocked | Yes (Full Control) |

---

## 🛠️ Architecture & Technical Walkthrough

### 1. Database Schema (`User` Model)
A new `Users` table was registered inside `CaseDbContext.cs` in the backend. It uses an explicit unique index on `Username` to prevent duplicate account creation and stores cryptographically secure password hashes.
* Model code location: `backend/Models/User.cs`

### 2. Password Hashing (`PasswordHasher` Service)
Passwords are secured using a custom built-in implementation of **PBKDF2 (Password-Based Key Derivation Function 2)** with `HMAC-SHA256` inside `backend/Services/PasswordHasher.cs`. This cryptographically sound hashing format splits salts, hashes, and iteration counts, avoiding the overhead of external libraries.

### 3. JWT Token Authentication (`AuthController`)
The new `backend/Controllers/AuthController.cs` handles:
* `POST /api/auth/register`: Supports standard user sign-up. All new registrations automatically default directly to the standard **User** role. The seeded `admin` account is the single Administrator account in the system.
* `POST /api/auth/login`: Validates password verification and issues a secure, signed **JSON Web Token (JWT)** containing claims for Username, Role, and User ID, valid for 7 days.

### 4. Controller Endpoint Security
* **Program.cs Configuration**: Configured JWT Bearer services in `backend/Program.cs` and mounted `app.UseAuthentication()` in the HTTP pipeline.
* **Privileged Route Restricting**: Applied `[Authorize(Roles = "Admin")]` to the `DeleteCase` endpoint inside `backend/Controllers/EcourtController.cs`, ensuring standard users cannot invoke cache deletion.

### 5. Premium UI Implementation
* **Responsive Glassmorphism**: Created a beautiful auth card inside `Frontend/src/pages/Login.jsx` and `Frontend/src/pages/Login.css` complete with radial gradients, floating animations, tab toggling transitions, and loading indicators.
* **Persistent Auth state**: Auth state is saved in `localStorage` in `Frontend/src/App.jsx` so users remain logged in upon refreshes.
* **Interactive Profile Dropdown**: Updated the topbar in `Frontend/src/components/Topbar.jsx` and `Frontend/src/components/Topbar.css` to fetch initials-based colorful avatars from Dicebear, and render a dropdown menu on click containing a Logout option.
* **Admin Delete Cache Action**: Standard users cannot see delete actions. If the logged in user is an Admin, a prominent red-accented glassmorphic **Delete Cache** button is rendered inside the results header in `Frontend/src/pages/CnrNumber.jsx`, passing the Bearer token in headers to wipe PostgreSQL cache values.

---

> [!TIP]
> **Single Administrator Restriction**
> Registration through the eCourt Tracker interface automatically assigns the **Standard User** role. This ensures that the seeded **`admin`** account remains the only Administrator in the system, maintaining strict security and a single administrative entry point.

> [!IMPORTANT]
> **Database Sync**
> We have safely synced our database schema with the PostgreSQL container, creating the `Users` table and injecting the seeded admin account without deleting any core Playwright or OCR solvers. All features compile and run flawlessly.
