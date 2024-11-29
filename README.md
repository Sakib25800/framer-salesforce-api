<p align="center">
  <img src="./assets/logo.svg" alt="Framer x Salesforce Logo" width="250"/>
</p>

# Framer Salesforce Plugin API

Backend for Framer Salesforce Plugin

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/auth/...` | OAuth [flow](https://github.com/framer/plugin-oauth) |
| POST | `/forms/create` | Generates a webhook endpoint to submit Framer forms to
| POST | `/forms/:formToken` | Handles form submission and upserts a Salesforce object |

## Form Routes

#### POST `/auth`
- OAuth routes - same as [backend](https://github.com/framer/plugin-oauth)

### Form Routes

#### Create Form Configuration
- **Endpoint:** `POST /forms/create`
- **Description:** Generates a webhook endpoint to send Framer form data to upsert a given Salesforce object
- **Request Body:**
  - `objectName` (string): The name of the Salesforce object.
- **Response:**
  - `webhook` (string): The URL to which form submissions should be sent.

#### Submit Form
- **Endpoint:** `POST /forms/submit/:formToken`
- **Description:** Handles form submissions to Salesforce, creating or updating Salesforce objects.
- **URL Parameters:**
  - `formToken` (string): The token associated with the form configuration.
- **Request Body:** A JSON object containing form data as key-value pairs.
- **Response:**
  - Success or error response from Salesforce.

#### Forward to Account Engagement
- **Endpoint:** `POST /forms/account-engagement/forward`
- **Description:** Transforms and forwards Framer form data to a specified Account Engagement form handler.
- **Query Parameters:**
  - `handler` (string): The URL of the Account Engagement form handler.
- **Request Body:** A JSON object containing form data as key-value pairs.
- **Response:**
  - The response text from the Account Engagement form handler.

## Environment Variables

```bash
# Salesforce OAuth Configuration
CLIENT_ID=XXXXXXX
CLIENT_SECRET=XXXXXXX

REDIRECT_PATH=/auth/redirect
OAUTH_BASE_URL=https://login.salesforce.com/services/oauth2
AUTHORIZE_PATH=/authorize
TOKEN_PATH=/token

SCOPE=api web pardot_api refresh_token offline_access

# CORS
PLUGIN_ID=""
PLUGIN_PARENT_DOMAIN=""

# Worker Config
WORKER_URL=https://localhost:8787

```

## Connected App Setup
1. Sign up for a [Salesforce Developer account](https://developer.salesforce.com/signup)
2. You should end up at the Setup page. If not, click on the gear icon in the top-right corner and press 'Setup'
3. Head to 'App Manager' via the quick finder > New Connected App > Create a Connected App
4. Enter basic info and such
5. Enable OAuth settings, select scopes and OAUTH callback/redirect URL
6. Enable PKCE, Require Secret for Web Server Flow, Require Secret for Refresh Token Flow
7. Fin
