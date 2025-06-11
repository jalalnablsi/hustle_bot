
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.ADMIN_JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: ADMIN_JWT_SECRET is not defined in environment variables. JWT generation will fail.");
  // In a real production app, you might want to throw an error here to prevent the app from starting
  // throw new Error("ADMIN_JWT_SECRET is not defined. Cannot generate JWTs.");
}

function generateAdminJwt(adminId: string, email: string, role: string): string {
  if (!JWT_SECRET) {
    // This check is redundant if the above check throws, but good for robustness if the top check is changed to a warning
    throw new Error("ADMIN_JWT_SECRET is not configured, cannot generate token.");
  }
  return jwt.sign(
    {
      id: adminId,
      email,
      role,
      isAdmin: true,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // صالحة لأسبوع
    },
    JWT_SECRET
  );
}

function verifyAdminToken(token: string): { id: string; email: string; role: string } | null {
  if (!JWT_SECRET) {
    console.error("ADMIN_JWT_SECRET is not configured, cannot verify token.");
    return null;
  }
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
  } catch (error) {
    console.error("Error verifying admin token:", error);
    // throw new Error('Invalid or expired token'); // Or return null
    return null;
  }
}

export { generateAdminJwt, verifyAdminToken };
