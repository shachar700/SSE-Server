const express = require('express');
const http = require('http');
const EventEmitter = require('events');

const app = express();
const server = http.createServer(app);
const port = 3000;

// Create an EventEmitter to notify subscribers of data changes
const sensorEmitter = new EventEmitter();

// Store connected clients (user IPs) and logs
let connectedClients = [];
let requestLogs = [];

// Store the latest sensor data
let latestSensorData = { s1: '', s2: '', s3: '', s4: '', date: '', time: '' };

// Middleware to parse JSON data from incoming requests
app.use(express.json());
app.use(express.static('public'));

// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', './views');

// Middleware to log GET and POST requests
app.use((req, res, next) => {
    const log = {
        method: req.method,
        url: req.url,
        data: req.body || null,
        timestamp: new Date().toISOString(),
    };
    requestLogs.push(log);
    console.log(log);
    next();
});

// SSE route for sending data to clients every 100ms
app.get('/subscribe', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Use req.ip (which will now correctly show the real client IP behind proxies)
  const clientIp = req.ip;

  if (!connectedClients.includes(clientIp)) {
      connectedClients.push(clientIp);
  }

  // Send updated sensor data to clients every 100ms
  const intervalId = setInterval(() => {
      res.write(`data: ${JSON.stringify(latestSensorData)}\n\n`);
  }, 100);

  req.on('close', () => {
      connectedClients = connectedClients.filter(client => client !== clientIp);
      clearInterval(intervalId);
  });
});

// /publish endpoint to receive sensor data and notify subscribers
app.post('/publish', (req, res) => {
    const newSensorData = req.body;

    // Validate the incoming data
    if (!newSensorData.s1 || !newSensorData.s2 || !newSensorData.s3 || !newSensorData.s4) {
        return res.status(400).json({ error: 'Invalid sensor data' });
    }

    // Update the latest sensor data
    latestSensorData = {
        s1: newSensorData.s1,
        s2: newSensorData.s2,
        s3: newSensorData.s3,
        s4: newSensorData.s4,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
    };

    // Emit a change event to notify all connected clients
    sensorEmitter.emit('change', latestSensorData);

    // Respond to the client
    res.json({ status: 'Sensor data updated and notified to subscribers' });
});

// Handle GET requests to render the main page
app.get('/', (req, res) => {
    res.render('index', { connectedClients, requestLogs });
});

// Start the server
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
