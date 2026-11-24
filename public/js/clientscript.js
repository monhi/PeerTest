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

/*
const ws = new WebSocket("ws://localhost:3158");

ws.onmessage = function (e) {
    console.log(e);
    if(e.data =="q")
    {
        switch(state)
        {
            case idle:
                ws.send("i");
            break;
            case ringing:
                ws.send("r");
            break;
            case conversation:
                ws.send("c");
            break;
        }
    }
    else if(e.data == "c")
    {
        Ring();
    }
};

ws.onclose = function (e) 
{
    console.log('connection closed.');
};

ws.onerror = function (e) 
{
  console.log(`Error occured ${e}`);
};
*/

const myPeer = new Peer(CLIENT_ID, {
    key: 'peerjs',
    host: '/',
    port: '3001',
    path: '/',
    secure: true,
});

clientVideo.muted = true;

const peers = {};

navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    addClientVideoStream(clientVideo, stream);
    console.log('own video play started.');
    myPeer.on('call', call => {
        call.answer(stream);
        console.log('create video mypeer.on call');
        var video = document.createElement('video');
        video.width  = 320;
        video.height = 240;
        
        call.on('stream', (userVideoStream) => {
            console.log("Calling on stream 1.");
            addServerVideoStream(video, userVideoStream);
        });
    });

    socket.on('user-connected', userId => {
        console.log('User connected: ' + userId);
    });
});

socket.on('user-disconnected', (userId) => {
    console.log("user-disconnected is called.");
});

socket.on('OP-DISCONNECT-CALL-OPERATOR', (roomId, userId) => {
    console.log(`Operator disconnected the call from ${roomId} to ${userId}`);
    if (
        (userId == CLIENT_ID)
        &&
        (roomId == current_room)
    ) {
        state = idle;
        //ws.send("i");
        document.getElementById("Call").textContent = "Call the center";
        document.getElementById("Call").classList.remove("btn-success");
        document.getElementById("Call").classList.remove("btn-danger");        
        document.getElementById("Call").classList.remove("btn-primary");        
        document.getElementById("Call").classList.add("btn-success");


        if (peers[userId]) {
            peers[userId].close();
        }
        videoGridServer.innerHTML = '';
    }
});

socket.on('OP-ACCEPT', (room, userId) => {

    console.log(`Operator accepted the call from ${room} to ${userId}`);
    if (userId == CLIENT_ID) {
        current_room = room;
        state = conversation;
        //ws.send("c");
        document.getElementById("Call").textContent = "Disconnect";
        document.getElementById("Call").classList.remove("btn-success");
        document.getElementById("Call").classList.remove("btn-danger");        
        document.getElementById("Call").classList.remove("btn-primary");        
        document.getElementById("Call").classList.add("btn-danger");
        socket.emit('join-room', current_room, userId);
    }
});

function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream);
    console.log("Calling myPeer.call", call, stream);
    console.log('create video connectToNewUser');
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
        console.log("Calling on stream 2.");
        addServerVideoStream(video, userVideoStream);
    });
    call.on('close', () => {
        video.remove();
    })
    peers[userId] = call;
}

function addClientVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGridClient.append(video);
}

function addServerVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGridServer.append(video);
}

socket.on('user-disconnected', userId => {
    console.log("user-disconnected is called.");
    if (state != idle) {
        state = idle;
        //ws.send("i");
        document.getElementById("Call").textContent = "Call the operator";
        document.getElementById("Call").classList.remove("btn-success");
        document.getElementById("Call").classList.remove("btn-danger");        
        document.getElementById("Call").classList.remove("btn-primary");        
        document.getElementById("Call").classList.add("btn-success");
    }

    if (peers[userId]) {
        peers[userId].close();
        videoGridServer.innerHTML = '';
    }
});

socket.on('RING_TIMEOUT', (userId) => {
    console.log(`RING_TIMEOUT is called for ${userId}.`);
    if (userId == CLIENT_ID) {
        if (state == ringing) {
            document.getElementById("Call").textContent = "Call the operator";
            document.getElementById("Call").classList.remove("btn-success");
            document.getElementById("Call").classList.remove("btn-danger");        
            document.getElementById("Call").classList.remove("btn-primary");            
            document.getElementById("Call").classList.add("btn-success");
            state = idle;
            //ws.send("i");
            document.getElementById("Notification").textContent = "کسی به درخواست تماس پاسخ نداد";
            setTimeout(() => {
                document.getElementById("Notification").textContent = "";
            }, 4000);
        }
        else {
            // do nothing.
        }
    }
});

function Ring() 
{
    if (state == idle) 
    {
        console.log(`Ring is called from ${CLIENT_ID}.`);
        socket.emit('RING', CLIENT_ID);
        document.getElementById("Call").textContent = "Calling ...";
        document.getElementById("Call").classList.remove("btn-success");
        document.getElementById("Call").classList.remove("btn-danger");        
        document.getElementById("Call").classList.remove("btn-primary");
        document.getElementById("Call").classList.add("btn-primary");

        state = ringing;
        //ws.send("r");
    }
    else if (state == ringing)
    {
        document.getElementById("Call").textContent = "Call the operator";
        document.getElementById("Call").classList.remove("btn-success");
        document.getElementById("Call").classList.remove("btn-danger");        
        document.getElementById("Call").classList.remove("btn-primary");
        document.getElementById("Call").classList.add("btn-success");
        state = idle;
        socket.emit('RING_CANCELLED', CLIENT_ID);
        videoGridServer.innerHTML = '';
        //ws.send("i");
    }
    else if (state == conversation) 
    {
        console.log(`disconnected from ${current_room} from ${CLIENT_ID}.`);
        document.getElementById("Call").textContent = "Call the operator";
        document.getElementById("Call").classList.remove("btn-success");
        document.getElementById("Call").classList.remove("btn-danger");        
        document.getElementById("Call").classList.remove("btn-primary");
        document.getElementById("Call").classList.add("btn-success");
        state = idle;
        socket.emit('DISCONNECT-CALL-CLIENT', current_room, CLIENT_ID);
        videoGridServer.innerHTML = '';
        //ws.send("i");
    }
}