const express = require('express');
const cors = require('cors');
const axios = require('axios');
const net = require('net');
const ping = require('ping');
const { spawn } = require('child_process');


const app = express();
app.use(cors());
app.use(express.json());

/** ========== MAC VENDOR LOOKUP ========== */
app.get('/mac-vendor', async (req, res) => {
  const mac = req.query.mac?.trim();

  if (!mac) {
    return res.status(400).json({ error: 'MAC address is required' });
  }

  try {
    const response = await axios.get(`https://api.macvendors.com/${mac}`);

    if (!response.data || response.data.toLowerCase().includes('not found')) {
      return res.status(404).json({ error: 'Vendor not found for this MAC' });
    }

    res.json({ vendor: response.data });

  } catch (error) {
    console.error('MAC Lookup Error:', error.message);
    res.status(500).json({
      error: 'MAC lookup failed',
      detail: error.message
    });
  }
});

/** ========== PORT CHECKER ========== */
app.get('/check-port', (req, res) => {
  const { ip, port } = req.query;

  if (!ip || !port) {
    return res.status(400).json({ error: 'IP and port are required' });
  }

  const socket = new net.Socket();
  socket.setTimeout(3000); // 3 seconds timeout

  socket.on('connect', () => {
    socket.destroy();
    res.json({ ip, port, status: 'open' });
  });

  socket.on('timeout', () => {
    socket.destroy();
    res.json({ ip, port, status: 'closed (timeout)' });
  });

  socket.on('error', () => {
    socket.destroy();
    res.json({ ip, port, status: 'closed' });
  });

  socket.connect(port, ip);
});


/** ========== TRACE ROUTE FINDER ========== */
app.get('/traceroute/:ip', (req, res) => {
  const ip = req.params.ip;
  const tracerouteCmd = process.platform === 'win32' ? 'tracert' : 'traceroute';
  const traceroute = spawn(tracerouteCmd, [ip]);

  res.setHeader('Content-Type', 'text/plain');

  traceroute.stdout.on('data', (data) => {
    res.write(data);
  });

  traceroute.stderr.on('data', (data) => {
    res.write(`Error: ${data.toString()}`);
  });

  traceroute.on('error', (err) => {
    res.write(`Failed to start traceroute: ${err.message}`);
    res.end();
  });

  traceroute.on('close', (code) => {
    if (code !== 0) {
      res.write(`\nTraceroute exited with code ${code} (possible failure or partial route)\n`);
    }
    res.end();
  });

  // Optional timeout (e.g., kill traceroute after 30 seconds)
  setTimeout(() => {
    traceroute.kill('SIGKILL');
    res.write('\nTraceroute timed out.\n');
    res.end();
  }, 30000);
});

/** ========== PING CHERKER ========== */
app.post('/ping-once', async (req, res) => {
  const { host } = req.body;
  try {
    const result = await ping.promise.probe(host);
    if (result.alive) {
      res.json({
        success: true,
        time: result.time,
        host
      });
    } else {
      res.json({
        success: false,
        host
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});




/** ========== START SERVER ========== */
app.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
  // console.log('📡 Endpoints: /mac-vendor?mac=XX:XX:XX:XX:XX:XX, /check-port?ip=IP&port=PORT');
});
