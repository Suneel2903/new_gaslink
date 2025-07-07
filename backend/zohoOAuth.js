require("dotenv").config();
const express = require("express");
const axios = require("axios");

const router = express.Router();

// 🔹 Step 1: Redirect user to Zoho login
router.get("/authorize", (req, res) => {
  const authorizeUrl = `https://accounts.zoho.in/oauth/v2/auth?scope=ZohoInvoice.invoices.CREATE,ZohoInvoice.invoices.READ,ZohoInvoice.contacts.READ,ZohoInvoice.settings.READ,ZohoInvoice.organization.READ&client_id=${process.env.ZOHO_CLIENT_ID}&response_type=code&access_type=offline&redirect_uri=${process.env.ZOHO_REDIRECT_URI}`;
  res.redirect(authorizeUrl);
});

// 🔹 Step 2: Zoho callback with authorization code
router.get("/callback", async (req, res) => {
  const authCode = req.query.code;
  try {
    const tokenResponse = await axios.post("https://accounts.zoho.in/oauth/v2/token", null, {
      params: {
        grant_type: "authorization_code",
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        redirect_uri: process.env.ZOHO_REDIRECT_URI,
        code: authCode,
      },
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // 🔹 Step 3: Get Organization ID
    const orgRes = await axios.get("https://invoice.zoho.in/api/v3/organizations", {
      headers: {
        Authorization: `Zoho-oauthtoken ${access_token}`,
      },
    });

    const orgId = orgRes.data.organizations[0].organization_id;

    console.log("✅ Access Token:", access_token);
    console.log("🔁 Refresh Token:", refresh_token);
    console.log("🏢 Organization ID:", orgId);

    res.send(`
      ✅ Auth Successful!<br/>
      🔐 Access Token: ${access_token}<br/>
      🔁 Refresh Token: ${refresh_token}<br/>
      🏢 Organization ID: ${orgId}
    `);
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error);
    res.status(500).send("OAuth Flow Failed");
  }
});

module.exports = router;
