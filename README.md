# Barcode Scanner - Airtable Integration Guide

Welcome to the documentation for the React + Tailwind CSS Barcode Scanner application. This guide will walk you through the necessary environment configuration, Airtable setup, and deployment processes required to get this application running in production.

## 1. Environment Variables Setup

Vite projects use `.env` files to manage environment variables. By default, only variables prefixed with `VITE_` are exposed to your client-side React code. 

To configure your application:
1. Create a file named `.env` in the root directory of your project.
2. Add your three required variables (see the template below).
3. These variables will be accessible in your application code via `import.meta.env.VITE_VARIABLE_NAME`.

### Required Variables:
- `VITE_AIRTABLE_BASE_ID`: Identifies the specific database in your Airtable workspace.
- `VITE_AIRTABLE_TOKEN`: The Personal Access Token used to authenticate API requests.
- `VITE_AIRTABLE_TABLE_NAME`: The exact name of the table containing your inventory data.

## 2. `.env.example` Template

Create a file named `.env.example` to commit to your repository, while keeping your actual tokens in a `.env` file that is listed in `.gitignore`.

```env
# .env.example
# DO NOT ADD YOUR ACTUAL SECRETS HERE. 
# Copy this file to '.env' and fill in the real values.

# The ID of your Airtable Base (starts with 'app')
# Found in the API documentation or URL when viewing your base.
VITE_AIRTABLE_BASE_ID="appXXXXXXXXXXXXXXXX"

# Your Airtable Personal Access Token (starts with 'pat')
# WARNING: Keep this secret! Do not commit your real token to version control.
VITE_AIRTABLE_TOKEN="patXXXXXXXXXXXXXXXX.YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY"

# The name of your table (case-sensitive)
VITE_AIRTABLE_TABLE_NAME="Inventory"
```

## 3. Airtable Setup Instructions

To retrieve the necessary credentials from Airtable:

### Creating the API Token (`VITE_AIRTABLE_TOKEN`):
1. Go to [Airtable Developer Hub](https://airtable.com/create/tokens).
2. Click **Create new token**.
3. Name your token (e.g., "Scanner App").
4. **Scopes:** Add `data.records:read` and `data.records:write`.
5. **Access:** Restrict this token to only the specific Base you are using for the scanner.
6. Click **Create token** and copy the string starting with `pat...`. You will only see this once.

### Finding the Base ID (`VITE_AIRTABLE_BASE_ID`):
1. Open your base in the Airtable UI.
2. Look at the URL in your browser: `https://airtable.com/appXXXXXXXXXXXXXX/tbl...`
3. The string starting with `app` (e.g., `appXXXXXXXXXXXXXX`) is your Base ID.

### Table Name (`VITE_AIRTABLE_TABLE_NAME`):
1. Use the exact name of the tab in your Airtable base (e.g., "Inventory" or "מלאי"). 

### Field Formatting
The application relies on these exact field names in your Airtable table:
- **`ברקוד`** (Barcode): Single line text
- **`שם המכשיר`** (Device Name): Single line text 
- **`סטטוס`** (Status): Single select with options: `פעיל`, `בתיקון`, `במחסן`
- **`חדר`** (Room/Location): Single line text or Single select
- **`מקט`** (SKU/Product Code): Single line text

*(Note: Field names must match exactly as the API queries are case and character sensitive)*

## 4. Security Best Practices ⚠️

In a purely client-side Application (SPA), any variable prefixed with `VITE_` ends up in the built JavaScript bundle. **This means your `VITE_AIRTABLE_TOKEN` will be visible to anyone who inspects the network requests or source code.**

### Implications:
If an unauthorized user acquires this token, they can read and modify the Airtable base that the token has access to. 

### Recommendations:
1. **Restrict Token Access:** The Personal Access Token (PAT) must ONLY have access to the specific base needed for this application, not your entire Airtable workspace.
2. **Restrict Scope:** The token should only have `data.records:read` and `data.records:write`. Do not give it schema creation or deletion privileges.
3. **Internal Deployment (VPN Server):** This client-side architecture is appropriate **only if the application is hosted on an internal corporate VPN** where only trusted employees can access the URL. Do not expose this SPA on the public internet.
4. **Token Rotation:** If you suspect the token has been compromised, revoke it immediately in the Airtable Developer Hub and generate a new one. Update your `.env` or deployment secrets and rebuild the application.
5. **Git Security:** Ensure your `.env` file is in your `.gitignore` to prevent accidentally committing it to a public or shared repository.

## 5. Vite Configuration for Environment Variables

Vite automatically exposes variables starting with `VITE_` via the `import.meta.env` object. No special proxy or node configuration is needed for the build step. 

```javascript
// Example of accessing variables safely
const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
const token = import.meta.env.VITE_AIRTABLE_TOKEN;

if (!baseId || !token) {
  console.error("Missing Airtable environment variables!");
}
```

During development (`npm run dev`), Vite reads directly from the `.env` file. During production build (`npm run build`), Vite hardcodes the current values of these variables into the output static files. 

## 6. Troubleshooting

### 1. CORS Errors
**Symptom:** API requests to Airtable fail, and the browser console mentions "Cross-Origin Request Blocked" or "CORS policy".
**Resolution:** Airtable's primary API (`api.airtable.com`) supports CORS globally. If you see CORS errors, it typically means your request is malformed (e.g., missing the Authorization header or making an unsupported pre-flight request). Ensure your fetch uses `Authorization: Bearer undefined` by checking that your `.env` variables are correctly loaded.

### 2. Variables appearing as `undefined`
**Symptom:** `import.meta.env.VITE_AIRTABLE_BASE_ID` is returning undefined.
**Resolution:** 
- Ensure the variable starts with `VITE_`.
- Check that your `.env` file is in the root directory (alongside `vite.config.ts`), not inside `/src`.
- Restart your Vite development server (`npm run dev`) after creating or modifying the `.env` file.

### 3. Authentication Failures (401 / 403)
**Symptom:** Airtable returns a "401 Unauthorized" or "403 Forbidden" error.
**Resolution:** 
- Verify the token hasn't expired or been revoked.
- Check that the token permissions include both `read` and `write`.
- Verify the token grants access to the specific Base ID you are querying. Ensure there are no extra spaces or quotes surrounding your variables in the `.env` file.

### 4. Records not found / Blank Returns
**Symptom:** A valid barcode is scanned, but the app says "Item not found".
**Resolution:** 
- The Airtable `filterByFormula` is extremely strict. Ensure that the table's field is literally named `ברקוד` and that the scanned text doesn't contain hidden trailing spaces.
- Note that Airtable table names are case-sensitive. Verify `VITE_AIRTABLE_TABLE_NAME` matches exactly.
