// backend/utils/authUtils.js
function getEffectiveUserId(user) {
  return user?.user_id || user?.uid || user?.firebase_uid;
}
module.exports = { getEffectiveUserId }; 