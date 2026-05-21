const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 3000;

app.use(express.json());

// Configure secure session memory tracking
app.use(session({
    secret: 'railoptix-super-secure-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 60 * 1000 } // Session expires automatically after 30 minutes
}));

// ============================================================================
// SECURITY SECURITY GATEKEEPER MIDDLEWARE
// ============================================================================
function isAdminAuthenticated(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next(); // User is authenticated, allow them to proceed
    }
    // Unauthorized access attempt -> redirect them to login page
    res.redirect('/developer/login');
}

// ============================================================================
// UI ROUTING WEB PORTALS
// ============================================================================
app.get('/', (req, res) => { 
    res.sendFile(path.resolve(__dirname, 'index.html')); 
});

app.get('/developer/login', (req, res) => { 
    res.sendFile(path.resolve(__dirname, 'login.html')); 
});

// Protect the main developer.html page using our gatekeeper middleware
app.get('/developer', isAdminAuthenticated, (req, res) => { 
    res.sendFile(path.resolve(__dirname, 'developer.html')); 
});

// ============================================================================
// AUTHENTICATION API ENDPOINT
// ============================================================================
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    // Set your custom developer credentials right here!
    if (username === 'admin' && password === 'IR@2026') {
        req.session.isAdmin = true; // Mark session as authenticated
        return res.json({ success: true });
    } else {
        return res.json({ success: false, message: 'Invalid Administrative Credentials' });
    }
});

// ============================================================================
// GRAPH TOPOLOGY API PIPELINES (All protected behind security blocks)
// ============================================================================
app.get('/api/list-stations', (req, res) => {
    exec(`"${path.join(__dirname, 'web_engine.exe')}" --list-stations`, (error, stdout) => {
        if (error) return res.status(500).json([]);
        const rawOutput = stdout.trim();
        if (!rawOutput) return res.json([]);
        const mappedList = rawOutput.split(',').map(entry => {
            const parts = entry.split(':');
            return { code: parts[0].toUpperCase(), name: parts[1] };
        });
        res.json(mappedList);
    });
});

app.get('/api/find-route', (req, res) => {
    const { from, to } = req.query;
    const command = `"${path.join(__dirname, 'web_engine.exe')}" "${from}" "${to}"`;
    exec(command, (error, stdout) => {
        if (error) return res.status(500).json({ error: 'Routing core execution fault.' });
        const rawOutput = stdout.trim();
        if (rawOutput.startsWith('ERROR')) return res.status(400).json({ error: 'No path found.' });
        const dataParts = rawOutput.split(',');
        res.json({ distance: dataParts[0], time: dataParts[1], path: dataParts.slice(2) });
    });
});

app.post('/api/add-station', isAdminAuthenticated, (req, res) => {
    const { code, name } = req.body;
    exec(`"${path.join(__dirname, 'web_engine.exe')}" --add-station "${code}" "${name}"`, (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.post('/api/add-track', isAdminAuthenticated, (req, res) => {
    const { fromCode, toCode, distance, time } = req.body;
    exec(`"${path.join(__dirname, 'web_engine.exe')}" --add-track "${fromCode}" "${toCode}" "${distance}" "${time}"`, (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.post('/api/remove-station', isAdminAuthenticated, (req, res) => {
    const { code } = req.body;
    exec(`"${path.join(__dirname, 'web_engine.exe')}" --remove-station "${code}"`, (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.post('/api/remove-track', isAdminAuthenticated, (req, res) => {
    const { fromCode, toCode } = req.body;
    exec(`"${path.join(__dirname, 'web_engine.exe')}" --remove-track "${fromCode}" "${toCode}"`, (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` RAILOPTIX SECURE REVOLUTIONARY NETWORK ONLINE         `);
    console.log(` Passenger Terminal : http://localhost:3000            `);
    console.log(` Protected Desk     : http://localhost:3000/developer  `);
    console.log(`=======================================================`);
});