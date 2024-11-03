<p align="center">
  <img src="./assets/logo.svg" alt="Framer x Salesforce Logo" style="width: 100%; max-width: 300px;"/>
</p>

# Framer Salesforce Plugin API

API to handle OAuth authentication and form submissions between for the Framer Salesforce Plugin.

## Features

- OAuth 2.0 authentication flow with PKCE
- Secure form token generation and validation
- Automatic token refresh handling
- Support for creating and updating Salesforce objects
- CORS protection for Framer plugin domains

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/` | Health check endpoint that confirms the API is running |
| POST | `/auth/authorize` | Initiates the OAuth flow and returns authorization URL |
| GET | `/auth/redirect` | OAuth redirect endpoint that handles the authorization code |
| POST | `/auth/poll` | Polls for completed authentication and returns tokens |
| POST | `/forms/create` | Creates a new form configuration and returns a form token |
| POST | `/forms/:formToken` | Handles form submission and creates/updates Salesforce objects |

## Detailed Route Explanations

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

```typescript
interface Bindings {
  CLIENT_ID: string;            // Salesforce OAuth client ID
  WORKER_URL: string;           // Base URL of the worker
  CLIENT_SECRET: string;        // Salesforce OAuth client secret
  PLUGIN_ID: string;           // Framer plugin ID
  PLUGIN_PARENT_DOMAIN: string; // Framer plugin parent domain
  REDIRECT_URI: string;         // OAuth redirect URI
  AUTHORIZE_ENDPOINT: string;   // Salesforce authorize endpoint
  TOKEN_ENDPOINT: string;       // Salesforce token endpoint
  SCOPE: string;               // OAuth scope
  OAUTH_KV: KVNamespace;       // KV namespace for token storage
}
```

## Error Handling

The API includes comprehensive error handling with:
- Custom `APIError` class for controlled errors
- Proper status codes and error messages
- CORS validation
- Token validation and refresh

## Security Features

- PKCE flow for OAuth
- Secure token storage
- CORS protection
- Temporary and permanent token storage separation
- UUID-based form tokens
