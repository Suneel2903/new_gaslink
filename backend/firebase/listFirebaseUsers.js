const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

admin.auth().listUsers(1000)
  .then((result) => {
    result.users.forEach((user) => {
      const email = user.email;
      const claims = user.customClaims || {};
      console.log(`${email} → Role: ${claims.role || 'none'}, Distributor: ${claims.distributor_id || '-'}`);
    });
  })
  .catch(console.error); 