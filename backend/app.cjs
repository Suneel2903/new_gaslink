const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { errorHandler } = require('./middleware/errorHandler.js');

// Initialize Firebase Admin SDK
const admin = require('firebase-admin');
const serviceAccount = require('./firebase/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Import routes
const userRoutes = require('./routes/users.js');
const orderRoutes = require('./routes/orderRoutes.js');
const customerRoutes = require('./routes/customers.js');
const cylinderTypeRoutes = require('./routes/cylinderTypes.js');
const cylinderPricesRoutes = require('./routes/cylinderPrices.js');
const inventoryRoutes = require('./routes/inventory.js');
const invoiceRoutes = require('./routes/invoices.js');
const paymentRoutes = require('./routes/payments.js');
const distributorRoutes = require('./routes/distributors.js');
const dashboardRoutes = require('./routes/dashboard.js');
const settingsRoutes = require('./routes/settings.js');
const ocrRoutes = require('./routes/ocrRoutes.js');
const vehicleRoutes = require('./routes/vehicles.js');
const zohoOAuthRoutes = require('./zohoOAuth.js');
const gstRoutes = require('./controllers/gstController.js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration (should be at the top)
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));
app.options('*', cors());

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 10000, // much higher for dev
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'GasLink API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/users', userRoutes);

// Test route for vehicle controller
app.get('/api/test-vehicle', async (req, res) => {
  try {
    const vehicleController = require('./controllers/vehicleController');
    res.json({ 
      success: true, 
      message: 'Vehicle controller loaded successfully',
      functions: Object.keys(vehicleController)
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack
    });
  }
});
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/distributors', distributorRoutes);
app.use('/api/cylinder-types', cylinderTypeRoutes);
app.use('/api/cylinder-prices', cylinderPricesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/vehicle', vehicleRoutes);
app.use('/api/gst', gstRoutes);

// Zoho OAuth Routes
app.use('/zoho', zohoOAuthRoutes);

// 404 handler for API routes (must be before static or catch-all)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GasLink API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API base: http://localhost:${PORT}/api`);
});

module.exports = app; 