# Zoho OAuth Integration Setup Guide

## Overview
This guide will help you set up Zoho Invoice API integration using OAuth 2.0 for automated invoice generation in GasLink.

## Prerequisites
1. Zoho Developer Account
2. Zoho Invoice Account
3. Node.js and npm installed

## Step 1: Create Zoho Application

1. Go to [Zoho Developer Console](https://api-console.zoho.com/)
2. Click "Add Client"
3. Choose "Self Client" for server-to-server integration
4. Fill in the details:
   - **Client Name**: GasLink Invoice Integration
   - **Homepage URL**: `http://localhost:5000`
   - **Authorized Redirect URIs**: `http://localhost:5000/zoho/callback`
   - **Scope**: Add the following scopes:
     - `ZohoInvoice.invoices.ALL`
     - `ZohoInvoice.contacts.ALL`
     - `ZohoInvoice.organization.READ`

## Step 2: Configure Environment Variables

Add the following variables to your `backend/.env` file:

```env
# Zoho OAuth Configuration
ZOHO_CLIENT_ID=your_zoho_client_id_here
ZOHO_CLIENT_SECRET=your_zoho_client_secret_here
ZOHO_REDIRECT_URI=http://localhost:5000/zoho/callback
```

## Step 3: Test the Integration

1. Start your backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Visit the authorization URL:
   ```
   http://localhost:5000/zoho/authorize
   ```

3. You'll be redirected to Zoho login page
4. After successful login, you'll be redirected back to:
   ```
   http://localhost:5000/zoho/callback
   ```

5. Check your server console for the tokens:
   - ✅ Access Token
   - 🔁 Refresh Token
   - 🏢 Organization ID

## Step 4: Available Endpoints

- **GET** `/zoho/authorize` - Initiates OAuth flow
- **GET** `/zoho/callback` - Handles OAuth callback

## Step 5: Next Steps

After successful authentication, you can:

1. Store the tokens securely in your database
2. Use the access token to make API calls to Zoho Invoice
3. Implement token refresh logic using the refresh token
4. Create invoice generation endpoints

## Troubleshooting

### Common Issues:

1. **Invalid Redirect URI**: Make sure the redirect URI in your Zoho app matches exactly: `http://localhost:5000/zoho/callback`

2. **Missing Environment Variables**: Ensure all Zoho variables are set in your `.env` file

3. **CORS Issues**: The OAuth flow should work as it's a server-side redirect, not an AJAX call

4. **Scope Issues**: Make sure you've added all required scopes in your Zoho application

### Error Messages:

- `OAuth Flow Failed`: Check your client ID, client secret, and redirect URI
- `Invalid authorization code`: The code has expired or is invalid (normal for OAuth)

## Security Notes

- Never commit your `.env` file to version control
- Store tokens securely in your database
- Implement proper token refresh logic
- Use HTTPS in production

## API Usage Examples

Once you have the tokens, you can make API calls like:

```javascript
// Create an invoice
const response = await axios.post('https://invoice.zoho.in/api/v3/invoices', {
  customer_id: 'customer_id',
  line_items: [...]
}, {
  headers: {
    'Authorization': `Zoho-oauthtoken ${access_token}`,
    'Content-Type': 'application/json'
  }
});
```

## Support

For Zoho API documentation, visit: https://www.zoho.com/invoice/api/ 