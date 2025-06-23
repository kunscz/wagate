import { PrismaClient } from '@prisma/client'

// export const prisma = new PrismaClient()
// if DATABASE_URL needs explicit configuration (based on your .env)
export const prisma = new PrismaClient({
   datasources: {
      db: {
         url: process.env.DATABASE_URL,
      },
   },
})