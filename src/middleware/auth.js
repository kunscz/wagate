import jwt from 'jsonwebtoken'
import { prisma } from '../utils/prisma.js'
import 'dotenv/config'

export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or Expired token' });
  }
};

// export const authMiddleware = async (req, res, next) => {
//    const token = req.headers.authorization?.split(' ')[1]
//    if (!token) {
//       return res.status(401).json({ error: 'No token provided' });
//    }

//    try {
//       if (!process.env.JWT_SECRET) {
//          return res.status(500).json({error: 'JWT_SECRET not configured' })
//       }
//       const decoded = jwt.verify(token, process.env.JWT_SECRET)
//       const user = await prisma.user.findUnique({ where: { id: decoded.userId } })
//       if (!user) {
//          return res.status(401).json({ error: 'Invalid token' })
//       }
//       req.user = user
//       next()
//    } catch (error) {
//       res.status(401).json({ error: 'Invalid token' })
//    }
// }