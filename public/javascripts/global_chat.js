$(function() {
  var COLORS = ['pink darken-1', 'indigo',
                'deep-orange darken-1', 'blue darken-2',
                'deep-purple', 'purple darken-1',
                'red darken-3','light-blue lighten-1'];
  var COLORS_TEXT = ['pink-text darken-1', 'indigo-text',
                     'deep-orange-text darken-1', 'blue-text darken-2',
                     'deep-purple-text', 'purple-text darken-1',
                     'red-text darken-3', 'light-blue-text lighten-1'];
  var TYPING_TIMER = 500;

  //initialize variables
  var $nameInput = $('#name');
  var $messageInput = $('#inputMessage');
  var $formHolder = $('.full-form-container')
  var $loginForm = $('#formLogin');
  var $chat = $('.chat');
  var $messages = $('.messages');
  var $contentHolder = $('.content-holder');
  var $users = $('.users');
  var $rooms = $('.rooms');
  var $roomForm = $('#formRoom');
  var $roomName = $('#roomName');

  var username;
  var typing = false;
  var canAddType = true;
  var lastTypingTime;
  var locked = false;
  var roomId;
  var socket = io();


  /* FOR PRIVATE CHATS */
  var pathArray = window.location.pathname.split('/');
  var base = pathArray[1];
  var id = pathArray[2];


  function submitUsername() {
    var name = $nameInput.val().trim();
    if (name && !locked) {
      socket.emit('check username', {
        roomId: roomId,
        username: name
      });
    }
  }

  function setUsername(name) {
    username = name;

    $.ajax({
      url: '/submitUsername',
      method: 'POST',
      data: {name: username},
      dataType: 'JSON'
    })
    .done(function() {
      $formHolder.fadeOut(function(){
        $loginForm.hide();
        $chat.show();
        $messageInput.focus();
      });
      socket.emit('add user', {
        username: name,
        roomId: roomId
      });
    })
    .fail(function(){
      alert('Error submitting username');
    });
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
      if (roomId != 'lobby') {
        msg += 'This is a private chat room. Please invite others by sending them this link.';
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
      hash = user.charCodeAt(i) + (hash<<2);
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

  function addUserToList(username) {
    var initial = username.charAt(0);

    var $li = $(
      '<li class="user-preview">' +
        '<div class="circle-preview ' + userColor(username, false) + '">'
          + initial +
        '</div>' +
        '<p>' + username + '</p>' +
      '</li>'
    );
    $li.data('username', username);
    $users.append($li);
    $users[0].scrollTop = $users[0].scrollHeight;
  }

  function removeUserFromList(username) {
    $('.user-preview').filter(function(i){
      return $(this).data('username') === username;
    }).remove();
  }

  function addRoomToList(roomName, id, isCurrent) {
    var route = '/chats/'+id;
    var $li = $(
      '<li id="' + roomName + '">' +
        '<span class="remove-room">  —  </span>' +
        '<a href="' + route + '">' + roomName + '</a>' +
      '</li>'
    );
    if (isCurrent) {
      $li.css('background-color', '#eaeef2');
    }
    $li.data('roomName', roomName);
    $rooms.append($li);
    $rooms[0].scrollTop = $rooms[0].scrollHeight;
  }

  function removeRoomFromList(roomName) {
    $('.rooms li').filter(function(i){
      return $(this).attr('id') === roomName;
    }).remove();

    $.ajax({
      url: '/deleteRoom',
      method: 'DELETE',
      data: {roomName: roomName},
      dataType: 'JSON'
    })
    .fail(function(){
      alert('Error deleting this room');
    });
  }

  function submitNewRoom() {
    if ($roomName) {
      socket.emit('check roomName', {
        roomName: $roomName.val().trim(),
        fromUrl: false
      });
    }
  }

  function createNewRoom() {
    var roomName = $roomName.val().trim();
    var id = Math.floor(Math.random()*9000)+1000;
    $.ajax({
      url: '/submitRoom',
      method: 'POST',
      data: {roomName: roomName, roomId: id},
      dataType: 'JSON'
    })
    .done(function(){
      $roomName.val('');
      $formHolder.hide();
      $roomForm.hide();
      socket.emit('create room', {
        roomName: roomName,
        roomId: id
      });
    })
    .fail(function(){
      alert('Error creating room');
    });
  }


  //set room info container height
  $contentHolder.outerHeight($(window).height()-64-100); //navbar, margin, input
  $('.user-list').height(0.5 * $contentHolder.height()-2);
  $('.room-list').height(0.5 * $contentHolder.height()-2);

  //Keyboard events
  $(window).keydown(function(event){
    if (event.which === 13) {  //'ENTER'
      event.preventDefault();
      if (!username) { //login
        submitUsername();
      } else if ($roomForm.css('display') != 'none') { //new room form
        submitNewRoom();
      } else { //send chat
        sendMessage();
      }
    }
  });

  //submit chat on button press
  $('#submitInput').click(function(){
    sendMessage();
  });

  $messageInput.on('input', function(){
    updateTyping();
  });

  $('#newRoom').click(function(){
    $formHolder.show();
    $roomForm.fadeIn(500);
    $roomName.focus();
  });

  $('.close').click(function(){
    $formHolder.hide();
    $roomForm.hide();
  });

  $(document).on('click', '.remove-room', function(){
    var toRemove = $(this).parent().attr('id');
    socket.emit('remove room', {
      roomName: toRemove
    });
  });

  //socket
  socket.on('connect', function(){
    if (base === 'chats' && id) {
      if (id.length === 4) {
        roomId = id;
      }
    } else {
      roomId = 'lobby';
    }
    socket.emit('load', roomId);
  });

  socket.on('load login', function(){
    //fade in login form, focus
    $loginForm.fadeIn(1000);
    $nameInput.focus();
  });

  socket.on('set username', function(data){
    username = data.username;
  });

  socket.on('load chat page', function(){
    $formHolder.hide();
    $loginForm.hide();
    $chat.show();
    $messageInput.focus();
  });

  socket.on('page does not exist', function(data) {
    $('#notFound').show();
  });

  socket.on('username passed', function(data){
    setUsername(data.username);
  });

  socket.on('username failed', function(){
    alert('This username has already been taken. Please choose a different one.');
  })

  socket.on('login', function(data){
    notify(null, data.numUsers);
  });

  socket.on('add user profile', function(data){
    addUserToList(data.username);
  });

  socket.on('roomName passed', function(){
    createNewRoom();
  });

  socket.on('roomName failed', function(){
    alert('You already have a room with this name');
  });

  socket.on('add room', function(data){
    addRoomToList(data.roomName, data.route, data.isCurrent);
  });

  socket.on('highlight lobby', function(){
    $('#lobbyLink').css('background-color', '#eaeef2');
  });

  socket.on('cannot remove room', function(){
    alert('You cannot delete the room you are currently in.');
  });

  socket.on('remove room', function(data){
    removeRoomFromList(data.roomName);
  });

  socket.on('redirect to room', function(data){
    window.location.href = "/chats/"+data.id;
  });

  socket.on('user joined', function(data){
    var change = data.username + ' joined.';
    notify(change, data.numUsers);
  });

  socket.on('user left', function(data){
    var change = data.username + ' left.';
    notify(change, data.numUsers);
    removeTypingMessage(data.username);
    removeUserFromList(data.username);
  });

  socket.on('new message', function(data){
    createChatMessage(data.message, data.username);
  });

  socket.on('separate messages', function() {
    var $floatClear = $('<div>').addClass('clear-floats');
    var $divider = $('<div class="divider-container">' +
                        '<div class="divider"></div>' +
                      '</div>');
    postMessage($floatClear);
    postMessage($divider);
  });

  socket.on('typing', function(data){
    addTypingMessage(data.username);
  });

  socket.on('stop typing', function(data){
    removeTypingMessage(data.username);
  });
});
