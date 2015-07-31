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
rooms['all'] = all;

var chat = io.on('connection', function(socket){
  var userJoined = false;

  //private chat?
  socket.on('join', function(roomId) {
    var room;
    if (rooms[roomId]) { //if room already exists
      room = rooms[roomId]
      console.log("room already exists");
    } else { //make new room
      room = new Room('test', roomId);
      console.log("making new room");
    }
    rooms[roomId] = room;
    socket.join(roomId);
    socket.room = roomId;
  });

  socket.on('add user', function(username){
    var room = socket.room ? socket.room : 'all';
    socket.join(room);
    socket.username = username;
    ++rooms[room].numUsers;
    userJoined = true;

    socket.emit('login', rooms[room].numUsers);
    socket.broadcast.to(room).emit('user joined', {
      username: username,
      numUsers: rooms[room].numUsers
    });
  });

  socket.on('new message', function(msg){
    var room = socket.room ? socket.room : 'all';

    socket.broadcast.to(room).emit('new message', {
      username: socket.username,
      message: msg
    });
  });

  socket.on('typing', function(){
    var room = socket.room ? socket.room : 'all';
    socket.broadcast.to(room).emit('typing', {
      username: socket.username
    });
  });

  socket.on('stop typing', function(){
    var room = socket.room ? socket.room : 'all';
    socket.broadcast.to(room).emit('stop typing', {
      username: socket.username
    });
  });

  socket.on('disconnect', function() {
    if (userJoined) {
      var room = socket.room ? socket.room : 'all';
      --rooms[room].numUsers;
      socket.leave(room);

      //notify everyone else that this user has left
      socket.broadcast.to(room).emit('user left', {
        username: socket.username,
        numUsers: rooms[room].numUsers
      });
    }
  });
});
