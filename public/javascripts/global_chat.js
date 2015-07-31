$(function() {
  var COLORS = ['pink darken-2', 'deep-orange darken-1',
                'blue darken-1', 'deep-purple',
                'purple darken-1', 'red darken-3',
                'light-blue'];
  var COLORS_TEXT = ['pink-text darken-2', 'deep-orange-text darken-1',
                     'blue-text darken-1', 'deep-purple-text',
                     'purple-text darken-1', 'red-text darken-3',
                     'light-blue-text'];
  var TYPING_TIMER = 500;

  //initialize variables
  var $nameInput = $('#name');
  var $messageInput = $('#inputMessage');
  var $loginForm = $('.form-card');
  var $chat = $('.chat');
  var $chatArea = $('.chatArea');
  var $messages = $('.messages');

  var username;
  var typing = false;
  var canAddType = true;
  var lastTypingTime;
  var socket = io();


  /* FOR PRIVATE CHATS */
  var pathArray = window.location.pathname.split('/');
  var base = pathArray[1];
  var id = pathArray[2];
  var privateRoom = false;

  if (base === 'chats' && id) {
    socket.emit('join', id);
    privateRoom = true;
  }


  function setUsername() {
    username = $nameInput.val().trim();
    if (username) {
      $loginForm.fadeOut(function(){
        $chat.show();
        $messageInput.focus();
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
      if (privateRoom) {
        msg += 'This is an empty chat room. Please invite others by sending them this link.';
      } else {
        msg += 'There is now 1 participant.';
      }
    } else {
      msg += 'There are now ' + numUsers + ' participants.';
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
          '<div class="circle ' + userColor(user, false) + '">'+initial+'</div>' +
          '<b></b>' +
        '</div>' +
        '<p></p>' +
      '</li>'
    );

    $li.find('p').text(message);
    $li.find('b').text(user);

    postMessage($li);
  }

  function userColor(user, forText) {
    var hash = 2;
    for (var i = 0; i < user.length; i++) {
      hash = user.charCodeAt(i) + (hash<<5);
    }
    var index = hash % COLORS.length;
    if (forText)
      return COLORS_TEXT[index];
    return COLORS[index];
  }

  function updateTyping() {
    if (!typing) {
      typing = true;
      socket.emit('typing');
    }
    lastTypingTime = (new Date).getTime();
    setTimeout(function(){
      var timer = (new Date).getTime();
      var timeDiff = timer - lastTypingTime;
      if (timeDiff >= TYPING_TIMER && typing) {
        socket.emit('stop typing');
        typing = false;
      }
    }, TYPING_TIMER);
  }

  function addTypingMessage(username) {
    var msg = " is typing...";
    var $el = $('<li class="notification typing">' +
                '<span class="' + userColor(username, true) + '">' + username + '</span>' +
                msg + '</li>');
    //var $el = $('<li>').addClass('notification typing').text(msg);
    $el.data('username', username);
    setTimeout(100, postMessage($el));
  }

  function removeTypingMessage(username) {
    canAddType = false;
    $('.notification.typing').filter(function(i){
      return $(this).data('username') === username;
    }).fadeOut(100, function(){
      $(this).remove();
    });
  }


  //fade in login form
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

  //submit chat on button press
  $('#submitInput').click(function(){
    sendMessage();
  })

  $messageInput.on('input', function(){
    updateTyping();
  })

  //socket
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
    removeTypingMessage(data.username);
  });

  socket.on('new message', function(data){
    createChatMessage(data.message, data.username);
  })

  socket.on('typing', function(data){
    addTypingMessage(data.username);
  });

  socket.on('stop typing', function(data){
    removeTypingMessage(data.username);
  });
});
