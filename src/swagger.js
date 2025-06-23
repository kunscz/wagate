import swaggerJSDoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'WhatsApp Gateway API',
      version: '1.0.0',
      description: 'REST API for WhatsApp Gateway using Baileys',
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
  // children: ['./src/**/*.{js,routesjs}']
}

const swaggerSpec = swaggerJSDoc(options)

export default swaggerSpec