// pages/api/debug-env.js
// TEMPORAIRE - à supprimer après diagnostic
module.exports = async function handler(req, res) {
  return res.status(200).json({
    ADMIN_EMAIL_SET: !!process.env.ADMIN_EMAIL,
    ADMIN_EMAIL_LENGTH: process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.length : 0,
    ADMIN_EMAIL_VALUE: process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.substring(0, 3) + "***" : "VIDE",
    ADMIN_PASSWORD_SET: !!process.env.ADMIN_PASSWORD,
    ADMIN_PASSWORD_LENGTH: process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.length : 0,
    NEXTAUTH_SECRET_SET: !!process.env.NEXTAUTH_SECRET,
    MONGODB_URI_SET: !!process.env.MONGODB_URI,
  });
};
