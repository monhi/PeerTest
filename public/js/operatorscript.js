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
const myPeer    = new Peer(ROOM_ID,{
    key: 'peerjs',
    host: '/',
    port: '3001',
    path: '/',
    secure: true,
});

console.log(myPeer);
///////////////////////////////////////////////////////////
const myVideo = document.createElement('video');
myVideo.className="server_window";
myVideo.muted = true;
var     peers={};
///////////////////////////////////////////////////////////
navigator.mediaDevices.getUserMedia({
    video:true,
    audio:true
}).then(stream =>{
    addVideoStream(myVideo,stream);
    console.log('Own video play started.');    
    myPeer.on('call',call =>{
        call.answer(stream);
        const video = document.createElement('video');
        call.on('stream',userVideoStream=>{
            console.log("Calling on stream 1.");
            addVideoStream(video,userVideoStream);
        });
    });

    socket.on('user-connected',userId =>{
        console.log('User connected: '+userId);
        connectToNewUser(userId,stream);
    });
});
////////////////////////////////////////////////////////////
socket.on('user-disconnected',userId=>{
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

myPeer.on('open',id=>{
    //socket.emit('join-room',ROOM_ID, id);
}); 

function connectToNewUser(userId,stream,idx)
{
    const call  = myPeer.call(userId,stream);
    console.log("Calling myPeer.call",userId,call,stream);    
    const video = document.createElement('video');
    video.className="client_window";
    call.on('stream',userVideoStream =>{
        console.log("Calling on stream 2.");
        addVideoStream(video,userVideoStream);
    });
    call.on('close',()=>{
        video.remove();
    });
    peers[userId] = call;
    currentUserId[idx] = userId;
}

function addVideoStream(video,stream)
{
    video.srcObject = stream; 
    video.addEventListener('loadedmetadata',()=>{
        video.play();
    });
    videoGrid.append(video);
}

socket.on('OP-ACCEPT',(room,userId)=>{
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

socket.on('OP-DISCONNECT-CALL-CLIENT',(room_id,userId)=>{
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

socket.on('RING_CANCELLED',(userId)=>{
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


socket.on('RING_TIMEOUT',(userId)=>{
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

socket.on('RING',(userId)=>{
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