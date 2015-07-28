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

io.on('connection', function(socket){
  console.log('connected');
  socket.on('newUser', function(username){
    socket.username = username;
  });
  socket.on('chat message', function(msg){
    io.emit('chat message', {
      username: socket.username,
      message: msg
    });
    console.log('server: chat message received with ' + socket.username);
  });
})
