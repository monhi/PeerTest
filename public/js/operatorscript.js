const   socket          = io('/');
const   MAX_CUSTOMER_NO = 8;
///////////////////////////////////////////////////////////
const   idle            = 0;
const   ringing         = 1;
const   conversation    = 2;
var     state           = [idle,idle,idle,idle,idle,idle,idle,idle];
var     currentUserId   = [-1,-1,-1,-1,-1,-1,-1,-1];
///////////////////////////////////////////////////////////
const videoGrid         = document.getElementById('video-grid');
var   RingAudio         = document.getElementById("myAudio");

// Operator's own camera stream, stored at module level so
// connectToNewUser() can reuse it.
let localStream = null;

///////////////////////////////////////////////////////////
function ProcessRing()
{
    let isConversation = 0;
    let isRinging    = 0;
    for(let i=0; i < MAX_CUSTOMER_NO; i++)
    {
        if(state[i] == ringing)
        {
            isRinging = 1;
        }
        if(state[i] == conversation)
        {
            isConversation = 1;
        }
    }

    if(isConversation)
    {
        RingAudio.pause();
    }
    else if(isRinging)
    {
        RingAudio.play();
    }
    else
    {
        RingAudio.pause();
    }
}
///////////////////////////////////////////////////////////

// ---- PeerJS 1.x config (matches server.js: PeerServer({port:3001, ssl:{...}}))
const myPeer = new Peer(OPERATOR_ID, {
    host: window.location.hostname,
    port: 3001,
    path: '/',
    secure: false,
    debug: 2
});

console.log(myPeer);

// ---- PeerJS diagnostics ----------------------------------------------------
myPeer.on('open', id => console.log('PEER OPEN (operator), my id:', id));
myPeer.on('error', err => console.error('PEER ERROR (operator):', err.type, err));
myPeer.on('disconnected', () => console.warn('PEER DISCONNECTED (operator)'));
myPeer.on('close', () => console.warn('PEER CLOSED (operator)'));

///////////////////////////////////////////////////////////
const myVideo = document.createElement('video');
myVideo.className="server_window";
myVideo.muted = true;
var     peers={};
///////////////////////////////////////////////////////////

// ---- Incoming call handler (registered before getUserMedia resolves) ------
// A client can call us; we answer with our own stream.
myPeer.on('call', call => {
    console.log('OPERATOR INCOMING CALL from', call.peer);

    call.on('error', err => console.error('OPERATOR INCOMING CALL ERROR:', err));
    call.on('close', () => console.warn('OPERATOR INCOMING CALL CLOSED'));

    const video = document.createElement('video');
    video.className = "client_window";
    video.width = 320;
    video.height = 240;
    video.autoplay = true;
    video.playsInline = true;

    let attached = false;
    call.on('stream', userVideoStream => {
        console.log('OPERATOR INCOMING REMOTE STREAM tracks:',
            userVideoStream.getTracks().map(t => t.kind));
        if (attached) return;
        attached = true;
        addVideoStream(video, userVideoStream);
    });

    if (localStream) {
        call.answer(localStream);
    } else {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(s => {
                localStream = s;
                addVideoStream(myVideo, s);
                call.answer(s);
            })
            .catch(err => console.error('operator getUserMedia (answer) failed:', err.name, err.message));
    }
});

navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    localStream = stream;
    addVideoStream(myVideo, stream);
    console.log('Own video play started.');

    socket.on('user-connected', userId => {
        console.log('User connected: ' + userId);
        // Find which slot this userId is ringing in, so we can record it.
        let idx = -1;
        for (let i = 0; i < MAX_CUSTOMER_NO; i++) {
            if (currentUserId[i] == userId) { idx = i; break; }
        }
        connectToNewUser(userId, stream, idx);
    });
}).catch(err => {
    console.error('operator getUserMedia failed:', err.name, err.message);
});

////////////////////////////////////////////////////////////
socket.on('user-disconnected', userId => {
    console.log("user-disconnected is called.");
    for(let i=0; i < MAX_CUSTOMER_NO; i++)
    {
        if((state[i] != idle) && (currentUserId[i] == userId))
        {
            let id   = "AcceptButton"+i;
            document.getElementById(id).textContent = "   ...   ";
            state[i] = idle;
            ProcessRing();
        }
        if(peers[userId])
        {
            peers[userId].close();
            peers = {};
        }
    }
});

myPeer.on('open', id => {
    //socket.emit('join-room',ROOM_ID, id);
});

// ---- Outgoing call (operator -> client) -----------------------------------
function connectToNewUser(userId, stream, idx)
{
    if (!myPeer || !myPeer.open) {
        console.error('operator connectToNewUser: myPeer not open, id =', userId);
        return;
    }
    const call = myPeer.call(userId, stream);
    if (!call) {
        console.error('operator myPeer.call returned undefined for', userId);
        return;
    }
    console.log("Calling myPeer.call", userId, call, stream);

    const video = document.createElement('video');
    video.className = "client_window";
    video.width = 320;
    video.height = 240;
    video.autoplay = true;
    video.playsInline = true;

    let attached = false;
    call.on('stream', userVideoStream => {
        console.log("Calling on stream 2. tracks:",
            userVideoStream.getTracks().map(t => t.kind));
        if (attached) return;
        attached = true;
        addVideoStream(video, userVideoStream);
    });
    call.on('error', err => console.error('operator OUTGOING CALL ERROR:', err));
    call.on('close', () => {
        video.remove();
    });
    peers[userId] = call;
    if (idx >= 0) currentUserId[idx] = userId;
}

function addVideoStream(video, stream)
{
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play().catch(e => console.warn('operator video play() rejected:', e));
    });
    videoGrid.append(video);
}

socket.on('OP-ACCEPT', (room, userId) => {
    console.log(`Operator accepted the call from ${room} to ${userId}`);

    for(let i=0; i < MAX_CUSTOMER_NO; i++)
    {
        if(
            (userId == currentUserId[i])
            &&
            (room != ROOM_ID)
        )
        {
            state[i] = idle;
            let id = "AcceptButton"+i;
            document.getElementById(id).textContent = "   ...   ";
            ProcessRing();
        }
    }
});

function EndCurrentCall()
{
    for(let i=0; i < MAX_CUSTOMER_NO; i++)
    {
        if(state[i] == conversation)
        {
            let id   = "AcceptButton"+i;
            state[i] = idle;
            socket.emit('DISCONNECT-CALL-OPERATOR',ROOM_ID,currentUserId[i]);
            document.getElementById(id).textContent = `   ...   `;
            if(peers[currentUserId[i]])
            {
                peers[currentUserId[i]].close();
                currentUserId[i] = -1;
                peers = {};
            }
        }
    }
}

socket.on('OP-DISCONNECT-CALL-CLIENT', (room_id, userId) => {
    console.log(`disconnect is received form ${userId}.`);
    for(let i=0; i < MAX_CUSTOMER_NO; i++)
    {
        if(
            (userId == currentUserId[i])
            &&
            (ROOM_ID == room_id)
          )
        {
            let id = "AcceptButton"+i;
            document.getElementById(id).textContent = "   ...   ";
            if(peers[currentUserId[i]])
            {
                peers[currentUserId[i]].close();
                peers = {};
                currentUserId[i] = -1;
            }
            state[i]   = idle;
        }
    }
    ProcessRing();
});

socket.on('RING_CANCELLED', (userId) => {
    console.log(`RING CANCEL is called for ${userId}.`);

    for(let i=0; i < MAX_CUSTOMER_NO; i++)
    {
        if(userId == currentUserId[i])
        {
            if(state[i] == ringing)
            {
                let id     = "AcceptButton"+i;
                document.getElementById(id).textContent = "   ...   ";
                state[i]   = idle;
                ProcessRing();
            }
        }
    }
});

socket.on('RING_TIMEOUT', (userId) => {
    console.log(`RING_TIMEOUT is called for ${userId}.`);
    for(let i=0; i < MAX_CUSTOMER_NO; i++)
    {
        if(userId == currentUserId[i])
        {
            if(state[i] == ringing)
            {
                let id = "AcceptButton"+ i;
                document.getElementById(id).textContent = "   ...   ";
                state[i]  = idle;
                ProcessRing();
            }
        }
    }
});

socket.on('RING', (userId) => {
    for(let i=0; i < MAX_CUSTOMER_NO; i++)
    {
        if(state[i] == idle)
        {
            console.log(`Ring detected from ${userId}.`);
            currentUserId[i] = userId;
            state[i] = ringing;
            let id = "AcceptButton"+ i;
            document.getElementById(id).textContent =  `Speaking to ${currentUserId[i]} `;
            ProcessRing();
            break;
        }
    }
});

function AcceptCall(idx)
{
    let id = "AcceptButton" + idx;
    if(state[idx] == ringing)
    {
        EndCurrentCall();
        state[idx] = conversation;
        socket.emit('ACCEPT',ROOM_ID,currentUserId[idx]);
        document.getElementById(id).textContent = `Disconnect ${currentUserId[idx]}`;
        socket.emit('join-room',ROOM_ID, currentUserId[idx]);
        ProcessRing();
    }
    else if(state[idx] == conversation)
    {
        state[idx] = idle;
        socket.emit('DISCONNECT-CALL-OPERATOR',ROOM_ID,currentUserId[idx]);
        document.getElementById(id).textContent = `   ...   `;
        for(let i=0; i < MAX_CUSTOMER_NO; i++)
        {
            if(peers[currentUserId[i]])
            {
                peers[currentUserId[i]].close();
                currentUserId[i] = -1;
                peers = {};
            }
        }
        ProcessRing();
    }
}