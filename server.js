//////////////////////////////////////////////////
const   fs 			= require('fs');
const   path 		= require('path');
const   express     = require("express");
const   https  	    = require('https');
const   http 		= require('http');
var     app         = express();
const 	cors 		= require('cors');

//app.use(cors);

const   PORT        = 4000;
//////////////////////////////////////////////////
app.set('view engine','ejs');
app.use(express.static('public'));
//////////////////////////////////////////////////

const options = {
    key:  fs.readFileSync(path.join(__dirname,'ssl','key.pem'), 'utf-8'),
    cert: fs.readFileSync(path.join(__dirname,'ssl','cert.pem'), 'utf-8')
}

//const httpsServer 		= http.createServer(app);
const httpsServer 	= https.createServer(options,app);
//////////////////////////////////////////////////
//const io            = require('socket.io')(httpsServer);


const io = require("socket.io")(httpsServer, {
  cors: {
    origin: "*",   
    methods: ["GET", "POST"]
  }
});



const {PeerServer}  = require('peer');

const peerServer = PeerServer({
    port: 3001
	,
    ssl: {
      key:  fs.readFileSync(path.join(__dirname,'ssl','key.pem'), 'utf-8'),
      cert: fs.readFileSync(path.join(__dirname,'ssl','cert.pem'), 'utf-8')
    }
  });

var   serverCntr    = 0;
var   clientCntr    = 0;
//////////////////////////////////////////////////
app.get("/",(req,res)=>{
    res.redirect(`/client-${clientCntr}`);
    clientCntr++;
});
//////////////////////////////////////////////////
app.get("/operator",(req,res)=>{
    res.redirect(`/operator-${serverCntr}`);
    serverCntr++;
});
//////////////////////////////////////////////////
app.get("/:room",(req,res)=>{
    console.log(`${req.params.room}`);
    if(req.params.room.includes("operator-"))
    {
        res.render('roomoperator',{roomId:req.params.room});
    }
    else
    {
        res.render('room',{roomId:req.params.room});
    }
});
//////////////////////////////////////////////////
io.on('connection',(socket) =>{
    console.log('joining to signaling room');
    socket.join('signalling');
    //////////////////////////////////////////////
    socket.on('join-room',(roomId,userId)=>{
        console.log("join-room event :",roomId,userId);
        socket.join(roomId);
        socket.join('signalling');
        console.log('user-connected event is emitted');
        setTimeout(()=>{
            socket.broadcast.to(roomId).emit('user-connected',userId);
            socket.on('disconnect',()=>{
                console.log('user-disconnected is emitted');
                socket.broadcast.to(roomId).emit('user-disconnected',userId);
            });
        },500);
    });
    //////////////////////////////////////////////
    socket.on('RING',(userId)=>{
        console.log(`Ring detected from ${userId}`);
        socket.broadcast.to('signalling').emit('RING',userId);
        setTimeout(()=>
        {
            socket.broadcast.to('signalling').emit('RING_TIMEOUT',userId);
            socket.emit('RING_TIMEOUT',userId);
            console.log(`ring timeout event is sent to ${userId}`);
        },30000);
    });

    socket.on('RING_CANCELLED',(userId)=>{
        console.log(`Ring cancel detected from ${userId}`);
        socket.broadcast.to('signalling').emit('RING_CANCELLED',userId);
    });    

    socket.on('ACCEPT',(room_id,userId)=>{
        console.log(`Accept received from ${room_id} for ${userId}`);
        socket.broadcast.to('signalling').emit('OP-ACCEPT',room_id,userId);
    });    

    socket.on('DISCONNECT-CALL-OPERATOR',(room_id,userId)=>{
        console.log(`disconnect call received for ${room_id} form ${userId}`);
        socket.broadcast.to('signalling').emit('OP-DISCONNECT-CALL-OPERATOR',room_id,userId);
    });   

    socket.on('DISCONNECT-CALL-CLIENT',(room_id,userId)=>{
        console.log(`disconnect call received form ${room_id} for ${userId}`);
        socket.broadcast.to('signalling').emit('OP-DISCONNECT-CALL-CLIENT',room_id,userId);
    });
});
////////////////////////////////////////////////////
httpsServer.listen(PORT);
console.log(`Listening on port ${PORT}`);