require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { errorHandler } = require('./middlewares/errorMiddleware');
const cron = require('node-cron');
const summaryService = require('./services/summaryService');

// Import routes
const userRoutes = require('./routes/userRoutes');
const tripRoutes = require('./routes/tripRoutes');
const alertRoutes = require('./routes/alertRoutes');
const groupRoutes = require('./routes/groupRoutes');
const routeRoutes = require('./routes/routeRoutes');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*', // Update with specific origins in production
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set JWT_SECRET from environment variables or use a default
if (!process.env.JWT_SECRET) {
  console.log('Warning: JWT_SECRET not set in environment variables, using default (not secure for production)');
  process.env.JWT_SECRET = 'saferoute_default_secret_key';
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Handle joining a group (for location updates)
  socket.on('join_group', (groupCode) => {
    console.log(`Client ${socket.id} joined group: ${groupCode}`);
    socket.join(groupCode);
  });
  
  // Handle location updates
  socket.on('location_update', (data) => {
    console.log(`Location update from ${data.userId} in group ${data.groupCode}`);
    // Broadcast to all members in the group
    io.to(data.groupCode).emit('location_update', data);
  });
  
  // Handle alerts
  socket.on('alert', (data) => {
    console.log(`Alert from ${data.userId}: ${data.type}`);
    io.to(data.groupCode).emit('alert', data);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/users', userRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/routes', routeRoutes);

// Default route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to SafeRoute API',
    status: 'Server is running',
    version: '1.0.0'
  });
});

// Error handling middleware
app.use(errorHandler);

// Schedule daily summary generation (runs at 9:00 PM every day)
// Format: minute hour day month weekday
cron.schedule('0 21 * * *', async () => {
  console.log('Running scheduled task: Generating daily summaries');
  try {
    const result = await summaryService.generateAllDailySummaries();
    console.log(`Daily summaries completed: ${result.success ? 'Success' : 'Failed'}`);
    if (result.totalUsers) {
      console.log(`Generated summaries for ${result.totalUsers} users`);
    }
    if (!result.success) {
      console.error('Error generating summaries:', result.error);
    }
  } catch (error) {
    console.error('Error in daily summary scheduled task:', error);
  }
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/saferoute');
    console.log('Connected to MongoDB');
    
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket server is ready for connections`);
      console.log('Daily summaries scheduled for 9:00 PM');
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
};

startServer(); 