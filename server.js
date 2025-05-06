const express = require('express');
const qrcode = require('qrcode');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 8080; // Internal port for this QR Manager service

// --- Use a persistent volume path if available ---
const DATA_DIR = process.env.DATA_VOLUME_PATH || path.join(__dirname, 'data'); 
const QR_STRING_FILE = path.join(DATA_DIR, 'current_qr_string.txt');
const CLIENT_ID_FILE = path.join(DATA_DIR, 'current_client_id.txt'); // File to store who the QR is for
// -----------------------------------------------

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)){
    console.log(`Creating data directory: ${DATA_DIR}`);
    fs.mkdirSync(DATA_DIR, { recursive: true });
} else {
    console.log(`Data directory exists: ${DATA_DIR}`);
}

app.use(bodyParser.urlencoded({ extended: true })); // For form submissions

// --- Admin Page ---
app.get('/admin', (req, res) => {
    let currentClient = '';
    try { currentClient = fs.readFileSync(CLIENT_ID_FILE, 'utf8'); } catch (e) {}
    
    res.setHeader('Content-Type', 'text/html');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Admin - Update QR</title></head>
        <body>
            <h1>Update WhatsApp QR String</h1>
            <p>Current QR is for Client ID: <strong>${currentClient || 'None'}</strong></p>
            <form action="/set-qr" method="post">
                <label for="clientId">Client ID (e.g., 'client1', 'john_doe'):</label><br>
                <input type="text" id="clientId" name="clientId" required><br><br>
                <label for="qrString">QR String (from Nezuko logs):</label><br>
                <textarea name="qrString" rows="8" cols="70" placeholder="Paste the long QR string (starting with 2@...) here..." required></textarea>
                <br><br>
                <button type="submit">Save and Update QR</button>
            </form>
            <br><hr><br>
            <p>Link for client '<span id="clientLinkName">${currentClient || '...'}</span>' to scan:</p>
            <a id="clientLink" href="/scan/${currentClient || ''}" target="_blank">/scan/${currentClient || ''}</a>
            <script>
                const clientIdInput = document.getElementById('clientId');
                const clientLinkName = document.getElementById('clientLinkName');
                const clientLink = document.getElementById('clientLink');
                clientIdInput.oninput = function() {
                    const id = clientIdInput.value || '...';
                    clientLinkName.textContent = id;
                    clientLink.href = '/scan/' + (clientIdInput.value || '');
                    clientLink.textContent = '/scan/' + (clientIdInput.value || '');
                };
            </script>
        </body>
        </html>
    `);
});

// --- Endpoint to receive QR string from admin ---
app.post('/set-qr', (req, res) => {
    const { qrString, clientId } = req.body; 
    if (qrString && typeof qrString === 'string' && clientId && typeof clientId === 'string') {
         let success = true;
         try {
             fs.writeFileSync(QR_STRING_FILE, qrString.trim(), 'utf8');
             console.log(`QR String Updated in file for client: ${clientId}`);
         } catch (err) {
             console.error("Error writing QR string file:", err);
             success = false;
         }
         try {
             fs.writeFileSync(CLIENT_ID_FILE, clientId.trim(), 'utf8');
             console.log(`Client ID updated to: ${clientId}`);
         } catch (err) {
             console.error("Error writing Client ID file:", err);
             success = false;
         }

         if(success) {
             res.status(200).send(`
                <h1>QR String Saved for Client: ${clientId}</h1>
                <p>Tell client to visit or refresh <a href="/scan/${clientId}" target="_blank">/scan/${clientId}</a></p>
                <br><a href="/admin">Update for another client</a>
             `);
         } else {
              res.status(500).send("Error saving QR string or Client ID to file.");
         }
    } else {
        res.status(400).send("Invalid request: 'qrString' and 'clientId' form fields are required.");
    }
});

// --- Client Scan Page ---
app.get('/scan/:clientId', async (req, res) => {
    const requestedClientId = req.params.clientId;
    let currentClientId = '';
    let currentQRString = null;
    let qrImageData = null;
    let displayMessage = '';

    try { currentClientId = fs.readFileSync(CLIENT_ID_FILE, 'utf8'); } catch (e) {}

    if (!requestedClientId || requestedClientId !== currentClientId) {
        displayMessage = `<p style="color: orange;">This QR link is not active or is for a different client (${currentClientId || 'None'}). Please ask the admin to generate a new link for you.</p>`;
    } else {
        currentQRString = fs.readFileSync(QR_STRING_FILE, 'utf8');
        if (currentQRString) {
            try {
                qrImageData = await qrcode.toDataURL(currentQRString);
            } catch (err) {
                console.error("Error generating QR code image:", err);
                displayMessage = `<p style="color: red;">Error generating QR code. Admin may need to update.</p>`;
            }
        } else {
             displayMessage = `<p style="color: orange;">QR code not available. Waiting for admin update...</p>`;
        }
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Scan QR for ${requestedClientId}</title>
             <meta http-equiv="refresh" content="20"> <!-- Refresh more slowly -->
            <style> body { font-family: sans-serif; text-align: center; margin-top: 30px; } img { border: 1px solid #ccc; } </style>
        </head>
        <body>
            <h1>Scan QR Code for ${requestedClientId}</h1>
            ${qrImageData ? `<img src="${qrImageData}" alt="WhatsApp QR Code" width="300" height="300">` : displayMessage}
            <p>(Page auto-refreshes)</p>
         </body>
        </html>
    `);
});

// --- Basic Root Redirect ---
 app.get('/', (req, res) => {
     res.redirect('/admin'); // Redirect root to admin page
 });


app.listen(port, () => {
    console.log(`QR Manager server listening on internal port ${port}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
