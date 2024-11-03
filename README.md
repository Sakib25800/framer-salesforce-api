<p align="center">
  <img src="./assets/logo.svg" alt="Framer x Salesforce Logo" width="250"/>
</p>

# Framer Salesforce Plugin API

API to handle OAuth authentication and form submissions for the Framer Salesforce Plugin.

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Health check endpoint that confirms the API is running |
| POST | `/auth/authorize` | Initiates the OAuth flow and returns authorization URL |
| GET | `/auth/redirect` | OAuth redirect endpoint that handles the authorization code |
| POST | `/auth/poll` | Polls for completed authentication and returns tokens |
| POST | `/forms/create` | Creates a new form configuration and returns a form token |
| POST | `/forms/:formToken` | Handles form submission and creates/updates Salesforce objects |

## Routes

### Authentication Routes

#### POST `/auth/authorize`
- Generates necessary PKCE parameters
- Creates temporary storage for OAuth state
- Returns authorization URL and read key for polling

#### GET `/auth/redirect`
- Handles OAuth callback from Salesforce
- Exchanges authorization code for tokens
- Stores tokens and returns success page

#### POST `/auth/poll`
- Checks for completed authentication
- Returns tokens if authentication is complete
- Used by client to retrieve tokens after redirect

### Form Routes

#### POST `/forms/create`
- Requires `orgId` and `objectType` in request body
- Validates org authentication
- Generates and returns secure form token and webhook URL

#### POST `/forms/:formToken`
- Handles form submissions to Salesforce
- Validates form token and org authentication
- Creates new object or updates existing one if duplicate
- Returns success/error response from Salesforce

## Environment Variables

```bash
# Salesforce OAuth Configuration
CLIENT_ID=XXXXXXX
CLIENT_SECRET=XXXXXXX

REDIRECT_URI=/auth/redirect
AUTHORIZE_ENDPOINT=https://login.salesforce.com/services/oauth2/authorize
TOKEN_ENDPOINT=https://login.salesforce.com/services/oauth2/token

SCOPE=api pardot_api openid refresh_token offline_access custom_permissions chatbot_api id profile email web

# CORS
PLUGIN_ID=""
PLUGIN_PARENT_DOMAIN=""

# Worker Config
WORKER_URL=http://localhost:8787

```
