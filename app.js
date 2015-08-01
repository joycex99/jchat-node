var express = require('express');
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
app.use(
  sassMiddleware({
    src: __dirname + '/sass',
    dest: __dirname + '/public/stylesheets',
    outputStyle: 'compressed',
    prefix:  '/stylesheets'  // Where prefix is at <link rel="stylesheets" href="prefix/style.css"/>
  })
);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res){
  res.render('global_chat', {private: false});
});

app.get('/chats/:id', function(req, res){
  var id = +req.params.id;
  res.render('global_chat', {private: true});
});


// GLOBAL CHAT
var all = new Room('Home', null);
rooms['lobby'] = all;

var chat = io.on('connection', function(socket){
  var userJoined = false;

  //private chat?
  socket.on('join', function(roomId) {
    var room;
    if (rooms[roomId]) { //if room already exists
      room = rooms[roomId]
    } else { //make new room
      room = new Room('test', roomId);
    }
    rooms[roomId] = room;
    socket.join(roomId);
    socket.room = roomId;
    socket.rooms[roomId] = rooms[roomId];

    socket.emit('add room', {
      roomName: 'Private',
      route: roomId
    });
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


    // for (var i = 0; i < room.members.length; i++) {
    //   var username = room.members[i];
    //   io.sockets.in(room).emit('add user profile', {
    //     username: username
    //   });
    // }
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
      socket.leave(room);
      rooms[room].removeMember(socket.username);

      //notify everyone else that this user has left
      socket.broadcast.to(room).emit('user left', {
        username: socket.username,
        numUsers: rooms[room].numUsers
      });
    }
  });
});
