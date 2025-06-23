# wagate

wagate is a gateway service that integrates with WhatsApp using the Baileys multi-device API and provides a RESTful and real-time (Socket.IO) backend, along with a Vite+Vue-based frontend.

## Features

- **WhatsApp Integration:** Leverages Baileys for connecting and interacting with WhatsApp accounts.
- **RESTful API:** Built on Express, provides endpoints for messaging, authentication, and WhatsApp session management.
- **Real-Time Communication:** Uses Socket.IO for event-driven, real-time features such as message updates and QR code delivery.
- **Authentication:** JWT-based authentication for secure API access.
- **Frontend:** Modern frontend built with Vite, Vue 3, Tailwind CSS, Pinia, and other best-in-class libraries.
- **Database & ORM:** Uses Prisma for database management.
- **API Documentation:** Swagger UI available at `/api-docs` after running the server.

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- WhatsApp account for integration

### Backend Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up environment variables (see `.env.example` or create a `.env` file).
3. Run database migrations (if using Prisma):
   ```bash
   npx prisma migrate deploy
   ```
4. Start the server:
   ```bash
   npm run dev
   ```
   The backend will start on `http://localhost:3000` by default.

### Frontend Setup

1. Go to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will start on `http://localhost:5173` by default.

### API Documentation

Once the backend is running, API documentation is accessible at:
```
http://localhost:3000/api-docs
```

## Project Structure

```
├── src/            # Backend source code (Express, services, etc.)
├── frontend/       # Vue 3 frontend app
├── prisma/         # Prisma schema and migrations
├── package.json    # Backend config & dependencies
├── LICENSE
└── README.md
```

## Technologies Used

- **Backend:** Node.js, Express, Prisma, Socket.IO, Baileys, JWT, Swagger
- **Frontend:** Vue 3, Vite, Tailwind CSS, Pinia, Vue Router
- **Other:** dotenv, bcrypt, qrcode, axios

## License

This project is licensed under the ISC License. See [LICENSE](LICENSE) for details.

---

*Author: nwm / kunscz*
