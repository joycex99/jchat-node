function Room(name, id) {
  this.name = name;
  this.id = id;
  this.numUsers = 0;
  this.members = [];
}

Room.prototype.addPerson = function(username) {
  this.members.push(username);
}

module.exports = Room;
