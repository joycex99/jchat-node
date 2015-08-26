var express = require('express');
var session = require('express-session');
var path = require('path');
var sassMiddleware = require('node-sass-middleware');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var Room = require('./room.js');
var app = express();

var port = process.env.PORT || 3000;

var io = require('socket.io').listen(app.listen(port));

var sessionMiddleware = session({
  name: 'jchat_session',
  secret: 'secret',
  cookie: {maxAge: null},
  resave: true,
  saveUninitialized: true
});

//configure app
app.set('view engine', 'jade');
app.set('views', path.join(__dirname, 'views'));
app.use(
  sassMiddleware({
    src: __dirname + '/sass',
    dest: __dirname + '/public/stylesheets',
    outputStyle: 'compressed',
    prefix:  '/stylesheets'
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(sessionMiddleware);

io.use(function(socket, next){
  sessionMiddleware(socket.request, socket.request.res, next);
});

/* SESSION INFO */
// username: stored as string
// userRooms: object, key = name, val = id
// previousRooms: array of userRooms keys (before adding new)

var rooms = {};
rooms['lobby'] = new Room('Lobby', 'lobby');
var chatHistory = {};
chatHistory['lobby'] = [];


/* ROUTES */
app.get('/', function(req, res){
  if (!req.session.previousRooms) {
    req.session.previousRooms = [];
  }
  if (!req.session.userRooms) {
    req.session.userRooms = {};
  }
  //set previous rooms to user rooms before adding new room to list
  req.session.previousRooms = Object.keys(req.session.userRooms);
  if (!req.session.userRooms['Lobby']) {
    req.session.userRooms['Lobby'] = 'lobby';
  }

  res.render('global_chat', {private: false});
});

app.get('/chats/:id', function(req, res) {
  var id = req.params.id;
  if (!req.session.previousRooms) {
    req.session.previousRooms = [];
  }
  if (!req.session.userRooms) {
    req.session.userRooms = {};
  }
  if (rooms[id]) {
    req.session.previousRooms = Object.keys(req.session.userRooms);
    var name = rooms[id].name;
    req.session.userRooms[name] = id;
  }
  res.render('global_chat', {private: true});
});

app.post('/submitUsername', function(req, res){
  req.session.username = req.body.name;
  res.send(req.body);
});

app.post('/submitRoom', function(req, res){
  rooms[req.body.roomId] = new Room(req.body.roomName, req.body.roomId);
  res.send(req.body);
});

app.delete('/deleteRoom', function(req, res){
  var toDelete = req.body.roomName;
  var id = req.session.userRooms[toDelete];
  var room = rooms[id];
  if (room) {
    --room.numReferences;
  }
  var index = req.session.previousRooms.indexOf(toDelete);
  if (index != -1) {
    req.session.previousRooms.splice(index, 1);
  }
  delete req.session.userRooms[toDelete];

  //delete room from system of 0 users and 0 references
  if (rooms[id].numUsers === 0) {
    if (rooms[id].numReferences == 0) {
      delete rooms[id];
      delete chatHistory[id];
    }
  }
  res.send(req.body);
});


/* CHAT SOCKET */

io.sockets.on('connection', function(socket){
  var username = socket.request.session.username;

  //check if room at incoming request exists
  socket.on('load', function(roomId) {
    //set socket room id to path given
    socket.room = roomId;

    var roomName = null;
    if (rooms[roomId]) {
      var roomName = rooms[roomId].name;
      checkSession(socket, roomId, roomName);
    } else {
      socket.emit('page does not exist');
    }
  });


  //check if room name is available
  socket.on('check roomName', function(data) {
    if (socket.userRooms && socket.userRooms[data.roomName]) {
      socket.emit('roomName failed');
    } else {
      socket.emit('roomName passed');
    }
  });

  //create room from name and randomly generated id, join
  socket.on('create room', function(data){
    var room = new Room(data.roomName, data.roomId);
    rooms[data.roomId] = room;
    chatHistory[data.roomId] = [];
    socket.emit('redirect to room', {id: data.roomId});
  });

  //
  socket.on('check username', function(data){
    if (rooms[data.roomId] && !rooms[data.roomId].contains(data.username)) {
      socket.emit('username passed', {
        username: data.username
      });
    } else {
      socket.emit('username failed');
    }
  });

  socket.on('remove room', function(data){
    var roomId = socket.userRooms[data.roomName];
    if (data.roomName === rooms[socket.room].name) {
      socket.emit('cannot remove room');
    } else {
      socket.emit('remove room', {
        roomName: data.roomName
      });
    }
  });

  //called on valid submission of username
  socket.on('add user', function(data){
    joinRoom(socket, data.roomId, rooms[data.roomId].name);
    addUser(socket, data.username);
  });

  socket.on('new message', function(msg){
    socket.broadcast.to(socket.room).emit('new message', {
      username: socket.username,
      message: msg
    });
    if (chatHistory[socket.room].length >= 10) {
      chatHistory[socket.room].splice(0, 1);
    }
    var msgObject = {username: socket.username, message: msg};
    chatHistory[socket.room].push(msgObject);
  });

  socket.on('typing', function(){
    socket.broadcast.to(socket.room).emit('typing', {
      username: socket.username
    });
  });

  socket.on('stop typing', function(){
    socket.broadcast.to(socket.room).emit('stop typing', {
      username: socket.username
    });
  });

  socket.on('disconnect', function() {
    var room = socket.room;
    if (socket.joinedRoom && rooms[room]) {
      var members = rooms[room].members;
      //disconnect user socket from room
      socket.leave(room);

      //if only one socket from that user, delete
      if (members[socket.username] === 1) {
        console.log('ONLY ONE SOCKET, DELETING USER')
        --rooms[room].numUsers;
        rooms[room].removeMember(socket.username);

        socket.broadcast.to(room).emit('user left', {
          username: socket.username,
          numUsers: rooms[room].numUsers
        });
      }
      //if multiple sockets connected, decrement member's socket count
      else {
        members[socket.username] -= 1;
        console.log('MULTIPLE SOCKETS, DECREMENTING MEMBER');
        console.log(rooms[room].members);
      }
    }
  });
});


//if no username (i.e. new session), load login
//otherwise, join room and add user
function checkSession(socket, roomId, roomName) {
  var username = socket.request.session.username;
  if (!username) {
    socket.emit('load login');
  } else {
    joinRoom(socket, roomId, roomName);
    addUser(socket, username);
    socket.emit('load chat page');
  }
}


//create and add room to list, or simply join
function joinRoom(socket, roomId, roomName) {
  socket.joinedRoom = true;
  if (!rooms[roomId]) { //if room doesn't exist yet, add
    room = new Room(roomName, roomId);
    rooms[roomId] = room;
  }
  socket.join(roomId);

  //add user rooms based on session variables and newly submitted socket variables
  var sessRooms = socket.request.session.userRooms;
  if (sessRooms) {
    socket.userRooms = sessRooms;
  } else {
    var roomName = rooms[roomId].name;
    socket.userRooms = {roomName: roomId};
  }
}


function addUser(socket, name) {
  var room = socket.room;
  socket.username = name;
  socket.emit('set username', {
    username: socket.username
  });

  if (!rooms[room].contains(name)) { //if user isn't already in the room
    console.log('New name, adding to room');
    ++rooms[room].numUsers;

    //add a reference to the room if user has rooms and current room not on it
    var sessRooms = socket.request.session.userRooms;
    var prevRooms = socket.request.session.previousRooms;

    if (!prevRooms) {
      ++rooms[room].numReferences;
    } else if (prevRooms.indexOf(rooms[room].name) === -1) {
      ++rooms[room].numReferences;
    }

    //let everyone else know user has joined
    socket.broadcast.to(room).emit('user joined', {
      username: name,
      numUsers: rooms[room].numUsers
    });

    //for everyone else, only add new member
    socket.broadcast.to(room).emit('add user profile', {
        username: name
    });
  }

  rooms[room].addMember(name);
  console.log(rooms[room].members);

  displayChatHistory(socket);
  updateSidebar(socket);
}

function displayChatHistory(socket) {
  var chatArray = chatHistory[socket.room];
  for (var i = 0; i < chatArray.length; i++) {
    socket.emit('new message', {
      message: chatArray[i].message,
      username: chatArray[i].username,
    });
  }
  if (chatArray.length > 0) {
    socket.emit('separate messages');
  }
}


function updateSidebar(socket) {
  var room = socket.room;

  //log user in with notification about number of participatns
  socket.emit('login', {
    numUsers: rooms[room].numUsers
  });

  for (var user in rooms[room].members) {
    socket.emit('add user profile', {
      username: user
    });
  }

  //add all user rooms to list
  for (var roomName in socket.userRooms) {
    if (roomName != 'Lobby') {
      var isCurrent = false;
      if (socket.userRooms[roomName] === socket.room) {
        isCurrent = true;
      }
      socket.emit('add room', {
        roomName: roomName,
        route: socket.userRooms[roomName],
        isCurrent: isCurrent
      });
    } else if (socket.room === 'lobby') {
      socket.emit('highlight lobby');
    }
  }
}

function contains(list, element) {
  return list.indexOf(element) != -1;
}
