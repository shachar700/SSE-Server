const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const os = require('os');
const fs = require('fs');
const app = express();

const uri = process.env.MONGODB_URI;

// MongoDB Setup
mongoose.connect(uri);

const simulationSchema = new mongoose.Schema({ name: String, data: Array });
const Simulation = mongoose.model('Simulation', simulationSchema);

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Core Data
let users = [];
let logs = [];
let sensorData = { station1: "", station2: "", station3: "", station4: "" };

// IP tracking and response subscription
app.use((req, res, next) => {
  req.clientIp = req.headers['x-forwarded-for'] || req.ip.remoteAddress;
  if (isRecording && req.path !== '/endRecording') {
    recordingBuffer.push({
      timestamp: new Date().toISOString(),
      requestType: req.method,
      requestPath: req.path,
      data: req.body
    });
  }
  next();
});

// Home route
app.get('/', (req, res) => {
  res.render('index', { users, logs });
});

// SSE: Subscribe
app.get('/subscribe', (req, res) => {
  const ip = req.clientIp;
  users.push({ ip, res });

  console.log(`New subscriber connected from IP: ${ip}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.write(`data: ${JSON.stringify(sensorData)}\n\n`);

  req.on('close', () => {
    users = users.filter(u => u.res !== res);
  });
});

// Publisher: POST sensor data
app.post('/publish', (req, res) => {
  const { station1, station2, station3, station4 } = req.body;

  if (station1 && station2 && station3 && station4) {
    sensorData = { station1, station2, station3, station4 };
    logs.push({ ...sensorData, timestamp: new Date().toLocaleString() });
    sendToSubscribers();
    res.status(200).send('Data received and broadcasted to subscribers');
  } else {
    res.status(400).send('Invalid data');
  }
});

// Send SSE to all clients
const sendToSubscribers = () => {
  const data = JSON.stringify(sensorData);
  users.forEach(({ res }) => {
    res.write(`data: ${data}\n\n`);
  });
};

// === Simulation Recording Logic ===
let isRecording = false;
let recordingBuffer = [];
let simulationCount = 0;

app.get('/startRecording', (req, res) => {
  if (isRecording) {
    endAndSaveRecording().then(() => {
      startNewRecording();
      res.status(200).send('Previous recording ended and new recording started');
    });
  } else {
    startNewRecording();
    res.status(200).send('Recording started');
  }
});

app.get('/endRecording', async (req, res) => {
  if (isRecording) {
    const saved = await endAndSaveRecording();
    res.status(200).json(saved.data);
  } else {
    res.status(400).send('No active recording');
  }
});

function startNewRecording() {
  isRecording = true;
  recordingBuffer = [];
  simulationCount += 1;
}

async function endAndSaveRecording() {
  isRecording = false;
  const name = `simulation_${simulationCount}`;
  const saved = await Simulation.create({ name, data: recordingBuffer });

  // Only write locally based on env variable
  if (process.env.LOCAL === 'true') {
    fs.writeFileSync(`${name}.json`, JSON.stringify(recordingBuffer, null, 2));
  }
  return saved;
}

// Helper: Get local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  const localIP = getLocalIP();
  console.log(`\nServer running at:`);
  console.log(`→ Local:   http://localhost:${port}`);
  console.log(`→ Network: http://${localIP}:${port}\n`);
});
