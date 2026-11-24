const socket = io('/');
const videoGridClient = document.getElementById('video-grid-client');
const videoGridServer = document.getElementById('video-grid-server');
const clientVideo = document.getElementById('clientVideo');
const idle = 0;
const ringing = 1;
const conversation = 2;
var state = idle;
var current_room;
var severVideo;

let localStream = null;

// ---- PeerJS 1.x config (matches server.js: PeerServer({port:3001, ssl:{...}}))
const myPeer = new Peer(CLIENT_ID, {
    host: window.location.hostname,
    port: 3001,
    path: '/',
    secure: false,
    debug: 2
});

// ---- PeerJS diagnostics ----------------------------------------------------
myPeer.on('open', id => console.log('PEER OPEN, my id:', id));
myPeer.on('error', err => console.error('PEER ERROR:', err.type, err));
myPeer.on('disconnected', () => console.warn('PEER DISCONNECTED'));
myPeer.on('close', () => console.warn('PEER CLOSED'));

// ---- Incoming call handler (registered before getUserMedia resolves) ------
myPeer.on('call', call => {
    console.log('INCOMING CALL from', call.peer);

    call.on('error', err => console.error('INCOMING CALL ERROR:', err));
    call.on('close', () => console.warn('INCOMING CALL CLOSED'));

    const video = document.createElement('video');
    video.width = 320;
    video.height = 240;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = false;

    let attached = false;
    call.on('stream', remoteStream => {
        console.log('REMOTE STREAM tracks:', remoteStream.getTracks().map(t => t.kind));
        if (attached) return;
        attached = true;
        addServerVideoStream(video, remoteStream);
    });

    if (localStream) {
        call.answer(localStream);
    } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(s => {
                localStream = s;
                addClientVideoStream(clientVideo, s);
                call.answer(s);
            })
            .catch(err => console.error('getUserMedia (answer) failed:', err.name, err.message));
    }
});

// ---- Local media -----------------------------------------------------------
clientVideo.muted = true;
const peers = {};

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then(stream => {
        localStream = stream;
        addClientVideoStream(clientVideo, stream);
        console.log('own video play started.');
        socket.on('user-connected', userId => console.log('User connected: ' + userId));
    })
    .catch(err => {
        console.error('getUserMedia failed:', err.name, err.message);
        const n = document.getElementById('Notification');
        if (n) n.textContent = 'دوربین باز نشد: ' + err.name;
    });

// ---- Socket.IO events ------------------------------------------------------
socket.on('OP-DISCONNECT-CALL-OPERATOR', (roomId, userId) => {
    console.log(`Operator disconnected the call from ${roomId} to ${userId}`);
    if (userId == CLIENT_ID && roomId == current_room) {
        state = idle;
        setCallButton('success', 'Call the center');
        if (peers[userId]) peers[userId].close();
        videoGridServer.innerHTML = '';
    }
});

socket.on('OP-ACCEPT', (room, userId) => {
    console.log(`Operator accepted the call from ${room} to ${userId}`);
    if (userId == CLIENT_ID) {
        current_room = room;
        state = conversation;
        setCallButton('danger', 'Disconnect');
        socket.emit('join-room', current_room, userId);
    }
});

socket.on('user-disconnected', userId => {
    console.log('user-disconnected is called.');
    if (state != idle) {
        state = idle;
        setCallButton('success', 'Call the operator');
    }
    if (peers[userId]) {
        peers[userId].close();
        videoGridServer.innerHTML = '';
    }
});

socket.on('RING_TIMEOUT', (userId) => {
    console.log(`RING_TIMEOUT is called for ${userId}.`);
    if (userId == CLIENT_ID && state == ringing) {
        setCallButton('success', 'Call the operator');
        state = idle;
        const n = document.getElementById('Notification');
        if (n) {
            n.textContent = 'کسی به درخواست تماس پاسخ نداد';
            setTimeout(() => { n.textContent = ''; }, 4000);
        }
    }
});

// ---- Helpers ---------------------------------------------------------------
function setCallButton(kind, text) {
    const btn = document.getElementById('Call');
    btn.textContent = text;
    btn.classList.remove('btn-success', 'btn-danger', 'btn-primary');
    btn.classList.add('btn-' + kind);
}

function connectToNewUser(userId, stream) {
    if (!myPeer || !myPeer.open) {
        console.error('connectToNewUser: myPeer not open, id =', userId);
        return;
    }
    const call = myPeer.call(userId, stream);
    if (!call) {
        console.error('myPeer.call returned undefined for', userId);
        return;
    }
    console.log('Calling myPeer.call', userId, call, stream);

    const video = document.createElement('video');
    video.width = 320;
    video.height = 240;
    video.autoplay = true;
    video.playsInline = true;

    let attached = false;
    call.on('stream', remoteStream => {
        console.log('REMOTE STREAM (outgoing) tracks:', remoteStream.getTracks().map(t => t.kind));
        if (attached) return;
        attached = true;
        addServerVideoStream(video, remoteStream);
    });
    call.on('error', err => console.error('OUTGOING CALL ERROR:', err));
    call.on('close', () => video.remove());
    peers[userId] = call;
}

function addClientVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.warn('client video play() rejected:', e));
    });
    videoGridClient.append(video);
}

function addServerVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.warn('server video play() rejected:', e));
    });
    videoGridServer.append(video);
}

function Ring() {
    if (state == idle) {
        console.log(`Ring is called from ${CLIENT_ID}.`);
        socket.emit('RING', CLIENT_ID);
        setCallButton('primary', 'Calling ...');
        state = ringing;
    } else if (state == ringing) {
        setCallButton('success', 'Call the operator');
        state = idle;
        socket.emit('RING_CANCELLED', CLIENT_ID);
        videoGridServer.innerHTML = '';
    } else if (state == conversation) {
        console.log(`disconnected from ${current_room} from ${CLIENT_ID}.`);
        setCallButton('success', 'Call the operator');
        state = idle;
        socket.emit('DISCONNECT-CALL-CLIENT', current_room, CLIENT_ID);
        videoGridServer.innerHTML = '';
    }
}