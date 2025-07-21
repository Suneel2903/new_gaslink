const cron = require('node-cron');
const { toOverdueCron } = require('./controllers/invoiceController');

// Schedule the cron job to run every day at 6am
cron.schedule('0 6 * * *', async () => {
    console.log('[CRON] Running overdue invoice updater...');
    try {
        const result = await toOverdueCron();
        console.log(`[CRON] Overdue invoice update complete: ${result.updated} invoices set to OVERDUE.`);
    } catch (err) {
        console.error('[CRON] Error running overdue invoice updater:', err);
    }
}, {
    timezone: 'Asia/Kolkata' // Set to your local timezone
});

console.log('Overdue invoice cron job scheduled to run daily at 6am.'); 