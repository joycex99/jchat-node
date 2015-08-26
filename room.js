function Room(name, id) {
  this.name = name;
  this.id = id;
  this.numUsers = 0;
  this.numReferences = 0;
  //name: # sockets (i.e. multiple windows open?)
  this.members = {};
}

Room.prototype.addMember = function(username) {
  if (!this.members[username]) { //if member does not exist yet
    this.members[username] = 1;
  } else { //increment count
    this.members[username] += 1;
  }
  //this.members.push(username);
}

Room.prototype.removeMember = function(username) {
  if (this.members[username]) {
    delete this.members[username];
  }
  // var index = this.members.indexOf(username);
  // if (index > -1) {
  //   this.members.splice(index, 1);
  // }
}

Room.prototype.contains = function(username) {
  return this.members[username] != null;
  // return (this.members.indexOf(username) != -1);
}

module.exports = Room;
