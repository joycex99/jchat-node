var express = require('express');
var session = require('express-session');
var path = require('path');
var sassMiddleware = require('node-sass-middleware');
var Room = require('./room.js');
var app = express();

var port = process.env.PORT || 3000;

var io = require('socket.io').listen(app.listen(port));
var rooms = {};

//configure app
app.set('view engine', 'jade');
app.set('views', path.join(__dirname, 'views'));
app.use(session({
  secret: 'secret',
  cookie: {maxAge: 60000},
  resave: false,
  saveUninitialized: false
}));
app.use(
  sassMiddleware({
    src: __dirname + '/sass',
    dest: __dirname + '/public/stylesheets',
    outputStyle: 'compressed',
    prefix:  '/stylesheets'
  })
);
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next){
  var sess = req.session;
  if (sess.views) {
    sess.views++;
  } else {
    sess.views = 1;
  }
  res.locals.views = sess.views;
  next();
})

app.get('/', function(req, res){
  res.render('global_chat', {private: false});
});

app.get('/chats/:id', function(req, res){
  var id = req.params.id;
  if (id.length === 4) {
    res.render('global_chat', {private: true});
  } else {
    res.end("This page does not exist");
  }
});


// GLOBAL CHAT
var all = new Room('Home', null);
rooms['lobby'] = all;

var chat = io.on('connection', function(socket){
  var userJoined = false;

  //check if room at incoming request exists
  //if so, join room, else, send back request asking
  //for room name
  socket.on('join with id', function(roomId) {
    var roomName = null;
    if (rooms[roomId]) {
      var roomName = rooms[roomId].name;
      joinRoom(socket, roomId, roomName);
    } else {
      socket.emit('ask for name', {
        roomId: roomId
      });
    }
  });

  //join room with given id and room name
  socket.on('join', function(data) {
    joinRoom(socket, data.roomId, data.roomName);
  });

  //create a random id for room, create room, redirect
  socket.on('create room', function(roomName){
    var id = Math.floor(Math.random()*9000)+1000;
    var room = new Room(roomName, id);
    rooms[id] = room;
    socket.emit('redirect to room', {id: id});
  });

  socket.on('check username', function(data){
    if (rooms[data.roomId] && !rooms[data.roomId].contains(data.username)) {
      socket.emit('username passed', {
        username: data.username
      });
    } else {
      if (!rooms[data.roomId])
        console.log('Room does not exist. Id: ' + data.roomId);
      else
        console.log('Username already in use');
      socket.emit('username failed');
    }
  });

  socket.on('add user', function(username){
    var room = socket.room ? socket.room : 'lobby';
    socket.join(room);
    socket.username = username;
    ++rooms[room].numUsers;
    rooms[room].addMember(username);
    userJoined = true;

    //log user in with notification about number of participatns
    socket.emit('login', {
      numUsers: rooms[room].numUsers
    });

    //add all room members to list
    for (var i = 0; i < rooms[room].members.length; i++) {
      var user = rooms[room].members[i];
      socket.emit('add user profile', {
        username: user
      });
    }

    //add all user rooms to the list

    //let everyone else know user has joined
    socket.broadcast.to(room).emit('user joined', {
      username: username,
      numUsers: rooms[room].numUsers
    });

    //for everyone else, only add new member
    socket.broadcast.to(room).emit('add user profile', {
        username: username
    });
  });

  socket.on('new message', function(msg){
    var room = socket.room ? socket.room : 'lobby';

    socket.broadcast.to(room).emit('new message', {
      username: socket.username,
      message: msg
    });
  });

  socket.on('typing', function(){
    var room = socket.room ? socket.room : 'lobby';
    socket.broadcast.to(room).emit('typing', {
      username: socket.username
    });
  });

  socket.on('stop typing', function(){
    var room = socket.room ? socket.room : 'lobby';
    socket.broadcast.to(room).emit('stop typing', {
      username: socket.username
    });
  });

  socket.on('disconnect', function() {
    if (userJoined) {
      var room = socket.room ? socket.room : 'lobby';
      --rooms[room].numUsers;
      rooms[room].removeMember(socket.username);

      //disconnect user socket from room
      socket.leave(room);

      //if room is empty, delete it from system so id can be reused
      //else, notify everyone else in room that user has left
      if (rooms[room].numUsers === 0 && room != 'lobby') {
        delete rooms[room];
      } else {
        socket.broadcast.to(room).emit('user left', {
          username: socket.username,
          numUsers: rooms[room].numUsers
        });
      }
    }
  });
});

//create and add room to list, or simply join
function joinRoom(socket, roomId, roomName) {
  var room;
  if (rooms[roomId]) { //if room already exists
    room = rooms[roomId];
  } else { //make new room
    room = new Room(roomName, roomId);
  }
  rooms[roomId] = room;
  socket.join(roomId);
  socket.room = roomId;
  socket.rooms[roomId] = rooms[roomId];

  socket.emit('add room', {
    roomName: rooms[roomId].name,
    route: roomId
  });
}
