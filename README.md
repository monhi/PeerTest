VideoTester

A simple PeerJS + Socket.IO video call demo with a client page and an operator page.

IMPORTANT: Manual Patch Required After npm install

The peer package (peer@1.0.2) is incompatible with the ws library version it pulls in. Its bundled code calls new ws.WebSocketServer(...) using the old CommonJS export style, but ws@8 only exposes WebSocketServer as a named ESM export. The result is a startup crash:

TypeError: (0 , ws.WebSocketServer) is not a constructor
at node_modules/peer/dist/index.cjs:271

Every time you run npm install (or npm ci), you must re-apply this one-line patch to node_modules/peer/dist/index.cjs:

Open node_modules/peer/dist/index.cjs.

Go to line 271. You will see:

this.socketServer = config.createWebSocketServer
? config.createWebSocketServer(options)
: new (0, 
c
l
6
I
w
cl6Iwws.WebSocketServer)(options);

Change WebSocketServer to Server:

this.socketServer = config.createWebSocketServer
? config.createWebSocketServer(options)
: new (0, 
c
l
6
I
w
cl6Iwws.Server)(options);

Save the file.

ws v8 still exposes Server as an alias in its CommonJS export, so new ws.Server(options) works and the PeerJS server starts normally.

This patch is temporary. It lives inside node_modules and is overwritten by any reinstall. The durable alternative is an overrides entry in package.json (for example "overrides": { "ws": "$ws" } with "ws": "^7.5.10" as a direct dependency) so npm resolves a compatible ws for peer automatically.

Requirements

Node.js 14 or newer

A modern browser (Firefox, Chrome, Edge)

Webcam and microphone

Setup

Open a command prompt in the project folder.

Install dependencies:

npm install

Re-apply the patch to node_modules/peer/dist/index.cjs (see the section above).

Start the server:

npm run start

The server listens on:

HTTPS app server on port 4000

PeerJS signaling server on port 3001

Usage

Open the client window in the browser:

https://localhost:4000

Open the operator window in the browser:

https://localhost:4000/operator

In the client window, click "Call the Operator".

In the operator window, answer the incoming call.

When the call is accepted, the remote video appears in the second video slot on each side (in #video-grid-server on the client page and in #video-grid on the operator page).

Project Structure

.
├── server.js Express + Socket.IO + PeerJS signaling
├── package.json
├── public/
│ ├── js/
│ │ ├── peerjs.min.js must be PeerJS 1.x (matches peer@1.x server)
│ │ ├── socket.io.js
│ │ ├── clientscript.js
│ │ └── operatorscript.js
│ ├── css/
│ ├── img/
│ ├── snd/Ring.mp3
│ └── font/
├── views/
│ ├── room.ejs client page
│ └── roomoperator.ejs operator page
└── ssl/
├── key.pem
└── cert.pem

Notes

PeerJS versions must match

peer@1.x on the server requires the PeerJS 1.x client build in public/js/peerjs.min.js. A 0.x client sends ?key=peerjs&token=... query parameters that the 1.x server ignores, and the WebSocket connection fails with "Firefox can't establish a connection to the server at wss://localhost:3001/peerjs?key=peerjs&...".

Download the 1.x build from https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js and overwrite public/js/peerjs.min.js.

Client and operator PeerJS configuration

Both clientscript.js and operatorscript.js build the PeerJS connection as:

const myPeer = new Peer(ID, {
host: window.location.hostname,
port: 3001,
path: '/',
secure: window.location.protocol === 'https:',
debug: 2
});

host is taken from the browser's current host, so the same code works whether the page is opened via localhost or a LAN IP.

secure follows the page protocol: wss:// on HTTPS pages, ws:// on HTTP pages.

path must match the PeerServer configuration in server.js. The default is /.

Firefox and the self-signed certificate

The server uses a self-signed certificate from ssl/. Firefox will silently block wss://localhost:3001 until you trust the certificate:

Open a new tab and go to https://localhost:3001/.

Click "Advanced...", then "Accept the Risk and Continue".

You may also need to do the same for https://localhost:4000/.

Mobile / LAN testing

The browser only grants camera access on secure contexts (HTTPS or localhost). If you open the app from a phone via http://<laptop-LAN-IP>:4000, navigator.mediaDevices is undefined and the camera will not start. To test from a phone you need either:

a trusted certificate for the LAN IP (for example generated with mkcert) and to open the app via https://<laptop-LAN-IP>:4000, or

Chrome on Android with chrome://flags/#unsafely-treat-insecure-origin-as-secure set to the app's HTTP URL.

Once the page is served over HTTPS, the secure setting in the PeerJS config automatically switches to wss://.

Source-map 404s in the console

peerjs.min.js.map and socket.io.js.map may 404 in the browser console. These are cosmetic. To silence them, either serve the .map files next to the .js files, remove the trailing //# sourceMappingURL=... comment from each minified file, or disable "Enable source maps" in the browser devtools.

Troubleshooting

Symptom: TypeError: (0 , ws.WebSocketServer) is not a constructor at startup
Likely cause: The peer patch was not applied after npm install. See the top of this README.

Symptom: Firefox can't establish a connection to the server at wss://localhost:3001/...
Likely cause: Self-signed certificate for port 3001 not trusted, or peerjs.min.js is still the 0.x build.

Symptom: PEER OPEN never prints in the console
Likely cause: PeerJS signaling server unreachable. Check that npm run start is running, port 3001 is listening, and the certificate is trusted.

Symptom: myPeer.call() returns undefined
Likely cause: myPeer is not open. Wait for PEER OPEN in the console before clicking Accept.

Symptom: Remote video never appears
Likely cause: Check the browser console for INCOMING CALL, REMOTE STREAM, and CALL ERROR messages. Also verify both peers use the same path and port as server.js.

Symptom: Camera does not start on a phone
Likely cause: The page is not a secure context (HTTP + LAN IP). Use HTTPS or the Chrome flag described above.