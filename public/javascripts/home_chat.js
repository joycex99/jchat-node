$(function() {

  var $nameInput = $('#name');
  var $messageInput = $('#inputMessage');
  var $loginForm = $('.form-card');
  var $chat = $('.chat');
  var $chatArea = $('.chatArea');
  var $messages = $('.messages');

  var socket = io();
  var username;

  function setUsername() {
    username = $nameInput.val().trim();
    if (username) {
      $loginForm.fadeOut(function(){
        $chat.show();
      });
      socket.emit('add user', username);
    }
  }

  function sendMessage() {
    message = $messageInput.val().trim();
    if (message) {
      $messageInput.val('');
      createChatMessage(message, username);
      socket.emit('new message', message);
    }
  }

  function notify(change, numUsers) {
    var msg = '';

    if (change)
      msg += change + ' ';

    if (numUsers === 1) {
      msg += 'There is now 1 participant.'
    } else {
      msg += 'There are now ' + numUsers + ' participants.'
    }

    //format
    var $el = $('<li>').addClass('notification').text(msg);
    postMessage($el);
  }

  function postMessage(el) {
    var $el = $(el);
    $messages.append($el);
    $messages[0].scrollTop = $messages[0].scrollHeight;
    console.log("scrollTop: " + $messages[0].scrollTop);
    console.log("scrollHeight: " + $messages[0].scrollHeight);
  }

  function createChatMessage(message, user) {
    var type = '';
    if (user === username) {
      type = 'chat-user';
    } else {
      type = 'chat-other'
    }

    var initial = user.charAt(0);

    var $li = $(
      '<li class=' + type + '>' +
        '<div class="profile">' +
          '<div class="circle">'+initial+'</div>' +
          '<b></b>' +
        '</div>' +
        '<p></p>' +
      '</li>'
    );

    $li.find('p').text(message);
    $li.find('b').text(user);

    postMessage($li);
  }



  $loginForm.animate({
    opacity: 1
  }, 1000);

  //Focus
  $nameInput.focus();

  //Keyboard events
  $(window).keydown(function(event){
    if (event.which === 13) {  //'ENTER'
      event.preventDefault();
      if (!username) { //login
        setUsername();
      } else { //send chat
        sendMessage();
      }
    }
  });


  socket.on('login', function(numUsers){
    notify(null, numUsers);
  });

  socket.on('user joined', function(data){
    var change = data.username + ' joined.';
    notify(change, data.numUsers);
  });

  socket.on('user left', function(data){
    var change = data.username + ' left.';
    notify(change, data.numUsers);
  });

  socket.on('new message', function(data){
    createChatMessage(data.message, data.username);
    console.log('client: other users received message');
  })


});
