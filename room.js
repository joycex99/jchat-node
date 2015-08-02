function Room(name, id) {
  this.name = name;
  this.id = id;
  this.numUsers = 0;
  this.members = [];
}

Room.prototype.addMember = function(username) {
  this.members.push(username);
}

Room.prototype.removeMember = function(username) {
  var index = this.members.indexOf(username);
  if (index > -1) {
    this.members.splice(index, 1);
  }
}

Room.prototype.contains = function(username) {
  for (var i = 0; i < this.members.length; i++) {
    if (this.members[i] === username) {
      return true;
    }
  }
  return false;
}

module.exports = Room;
