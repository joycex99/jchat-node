var express = require('express');
var path = require('path');
var sassMiddleware = require('node-sass-middleware');
var app = express();

var port = process.env.PORT || 3000;

var io = require('socket.io').listen(app.listen(port));
//var io = require('socket.io')(server);

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
  res.render('index');
})


var numUsers = 0;

io.on('connection', function(socket){
  console.log('connected');
  var userJoined = false;

  socket.on('add user', function(username){
    socket.username = username;
    ++numUsers;
    userJoined = true;

    socket.emit('login', numUsers);
    socket.broadcast.emit('user joined', {
      username: username,
      numUsers: numUsers
    });
  });

  //check io.emit instead of socket.emit

  socket.on('new message', function(msg){
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: msg
    });
    console.log('server: chat message received from ' + socket.username);
  });

  socket.on('disconnect', function() {
    if (userJoined) {
      --numUsers;

      //notify everyone else that this user has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
