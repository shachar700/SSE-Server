const express = require('express');
const app = express();
const path = require('path');

// Set up EJS for templating
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware for parsing JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Track connected users, logs, and data
let users = [];
let logs = [];
let sensorData = { station1: "", station2: "", station3: "", station4: "" };

// Home route to render the EJS view
app.get('/', (req, res) => {
  res.render('index', { users, logs });
});

// Publisher POST endpoint: This is where the publisher (sensor) sends data
app.post('/publish', (req, res) => {
  const { station1, station2, station3, station4 } = req.body;

  if (station1 && station2 && station3 && station4) {
    // Update the latest sensor data
    sensorData = { station1, station2, station3, station4 };
    
    // Log the data received
    logs.push({ station1, station2, station3, station4, timestamp: new Date().toLocaleString() });

    // Notify all connected subscribers (via SSE)
    sendToSubscribers();

    res.status(200).send('Data received and broadcasted to subscribers');
  } else {
    res.status(400).send('Invalid data');
  }
});

// SSE endpoint: Send data to subscribers
app.get('/subscribe', (req, res) => {
  const userID = Date.now();  // Unique ID for each user based on timestamp
  users.push( res );

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send the current sensor data to the subscriber
  res.write(`data: ${JSON.stringify(sensorData)}\n\n`);

  // Clean up when the user disconnects
  req.on('close', () => {
    users = users.filter(user => user.id !== userID);
    clearInterval(interval);
  });
});

// Function to notify all subscribers when new data is received from the publisher
const sendToSubscribers = () => {
  // Here you can implement logic to send data to all connected subscribers.
  // For simplicity, we're pushing the data to subscribers through SSE every 2 seconds.
  users.forEach(user => {
    user.write("Hi")
  });
};

// Start the server (for local development)
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
