'use strict';

// Chat-Class
function Chat(port) {

    // Creating required variables
    var express = require('express'),
        chatapp = express(),
        chatserver = require('http').createServer(chatapp),
        io = require('socket.io').listen(chatserver),
        fs = require('fs'),
        readline = require('readline'),
        bigInt = require('big-integer'),
        conf = require('./config/config.json'), // General Config
        userranks = require('./config/users.json'), // User Savings
        ranks = require('./config/ranks.json'), // Ranks Config
        mongoose = require('mongoose');


    log('[CORE] Server is starting');

    // Object for user-class collection
    var users = {};

    // Object for connecting usernames to socket-ids
    var usernames = {};

    // Object for timeouted users
    var timeout = {};

    // Object for different rooms
    var rooms = {};

    // Creating the user-class
    function User(username, socketid, mysocket, doc) {
        var user = {
            'username': username,
            'socketid': socketid,
            'socket': mysocket,
            'doc': doc
        };
        return user;
    }

    // Creating room constructor 

    function room(password, name, maxusers) {

        var room_id = makeid();

        var room = {
            name: name,
            password: password,
            maxusers: maxusers,
            users: [],
            room_id: room_id
        };

        rooms[room_id] = room;

        return room;
    }

    // Creating the rank-class
    function Rank(name) {

        // Initiating rank-variable
        var rank = {
            'mute': false,
            'ignore': false,
            'name': false,
            'ban': false,
            'unban': false,
            'kick': false,
            'short': name,
            'displayname': '',
            'promote': false,
            'rename': false
        }

        // Get the rules of the rank
        rank.mute = getRule(name, 'mute');
        rank.ignore = getRule(name, 'ignore');
        rank.name = getRule(name, 'name');
        rank.ban = getRule(name, 'ban');
        rank.unban = getRule(name, 'unban');
        rank.kick = getRule(name, 'kick');
        rank.displayname = getRule(name, 'displayname');
        rank.promote = getRule(name, 'promote');
        rank.rename = getRule(name, 'rename');


        return rank;
    }

    // Creating array for banned users
    var banned = [];

    // Loading all banned users --> see Function
    getBans();

    if (conf.authentification === 'mongo') {
        log('Starting mongo connection...')
        var db = mongoose.createConnection(conf.auth_token.connect_uri);
        db.on('error', console.error.bind(console, 'connection error:'));
        db.once('open', function () {
            log("[MONGOOSE] Mongoose Connection established!");
        });
    }
    // socket.io server listening
    chatserver.listen(port);

    // Basic answer that server is running
    log('[CORE] Chat server reachable under http://127.0.0.1:' + port + '/');



    // ********* SOCKET SECTION **********

    io.sockets.on('connection', function (socket) {
        // Client is connected

        // Just telling him
        socket.emit('chat', {
            zeit: new Date(),
            text: 'Connecting...'
        });
        log('[CORE] New user with ID [' + socket.id + '] trying to connect');

        // Event on disconnect
        socket.on('disconnect', function () {
            // Caching info
            var index = users[socket.id];
            var id = socket.id;
            if (index) {
                // Delete all online-references
                delete usernames[users[socket.id].username];
                delete users[socket.id];

                log('[CORE] User with ID [' + id + '] disconnected');
            }

        });

        // Handshake for Authentification --> very simple --> need check for illegal requests on server side
        socket.on('handshake', function (data) {

            if (conf.authentification === 'token') {
                // If token Authentification is enabled
                var token = data.token;
                var username = data.username;

                var tmp_schema = require(conf.auth_token.usr_model_file)[conf.auth_token.usr_model_name];

                var tmp_user = mongoose.model('user', tmp_schema);

                tmp_user.findOne({
                    username: username,
                    token: token
                }, function (err, doc) {
                    if (!doc) {
                        socket.emit('handshake', {
                            zeit: new Date(),
                            text: 'Invalid credentials'
                        });
                    } else {
                        if (banned.indexOf(data.username) >= 0) {
                            log('[CHAT] Banned user ' + data.username + ' tried to connect');
                            socket.emit('chat', {
                                zeit: new Date(),
                                text: 'You are banned from the server!'
                            });
                            // Disconnecting him
                            socket.disconnect('You are banned!');
                        } else {

                            // Creating a user object
                            var newuser = User(data.username, socket.id, socket, doc);
                            // Getting his rank
                            newuser['rank'] = Rank(getRank(data.username));
                            // Adding him to mapping object
                            usernames[data.username] = socket.id;
                            // Adding his user object
                            users[socket.id] = newuser;
                            // Logging
                            log('[CHAT] Handshake for User [' + socket.id + '] completed');
                            log('[CHAT] User [' + socket.id + '] indentified as name [' + users[socket.id].username + ']');

                        }
                    }
                });

            } else {
                // Checking if user is banned on connect
                if (banned.indexOf(data.username) >= 0) {
                    log('[CHAT] Banned user ' + data.username + ' tried to connect');
                    socket.emit('chat', {
                        zeit: new Date(),
                        text: 'You are banned from the server!'
                    });
                    // Disconnecting him
                    socket.disconnect('You are banned!');
                } else {

                    // Creating a user object
                    var newuser = User(data.username, socket.id, socket, undefined);
                    // Getting his rank
                    newuser['rank'] = Rank(getRank(data.username));
                    // Adding him to mapping object
                    usernames[data.username] = socket.id;
                    // Adding his user object
                    users[socket.id] = newuser;
                    // Logging
                    log('[CHAT] Handshake for User [' + socket.id + '] completed');
                    log('[CHAT] User [' + socket.id + '] indentified as name [' + users[socket.id].username + ']');

                }
            }
        });

        socket.on('status', function (data) {
            // Client is requesting status
            if (users[socket.id]) {
                // Handshake completed --> User ok
                socket.emit('chat', {
                    zeit: new Date(),
                    text: 'Connection successful'
                });
                log('[CHAT] User [' + socket.id + '] requested status: Handshake ok');
            } else {
                // Handshake not completed --> User ok
                socket.emit('chat', {
                    zeit: new Date(),
                    text: 'Connection refused: no_handshake'
                });
                log('[CHAT] User [' + socket.id + '] requested status: No handshake');
            }
        });

        // User connecting log


        // User is issuing a message
        socket.on('chat', function (data) {
            //Checking if user is free to write 
            var check = checkUser(users[socket.id].username);
            if (check === true) {
                if (users[socket.id]) {

                    // Spliting for possible parameters and commands
                    var msg = data.text.toString().split(" ");

                    // Check if it is a command
                    if (msg[0].indexOf('/') > -1) {

                        // Which command ?
                        switch (msg[0]) {
                            case "/ban":
                                // Permission checking 
                                if (checkRule(users[socket.id], 'ban')) {
                                    if (banned.indexOf(msg[1]) >= 0) {
                                        socket.emit('chat', {
                                            zeit: new Date(),
                                            text: 'The user is already banned!'
                                        });
                                    } else {
                                        // Performing ban --> see ban()
                                        ban(msg[1]);
                                        socket.emit('chat', {
                                            zeit: new Date(),
                                            text: 'The user ' + msg[1] + ' got banned!'
                                        });
                                        log('[CHAT] User [' + users[socket.id].username + '] banned User ' +
                                            msg[1]);
                                    }
                                } else {
                                    // User is not allowed to do this
                                    socket.emit('chat', {
                                        zeit: new Date(),
                                        text: 'You do not have the permission to do this!'
                                    });
                                    log('[CHAT] User [' + socket.id + '] tried calling command : ' +
                                        msg[0]);
                                }
                                break;
                            case "/unban":
                                // Checking for permission
                                if (checkRule(users[socket.id], 'unban')) {
                                    // Check if user is banned
                                    if (banned.indexOf(msg[1]) >= 0) {
                                        // Unbanning user --> see unban()
                                        unban(msg[1]);
                                        socket.emit('chat', {
                                            zeit: new Date(),
                                            text: 'The user ' + msg[1] + ' was unbanned!'
                                        });

                                    } else {
                                        socket.emit('chat', {
                                            zeit: new Date(),
                                            text: 'The user is not banned!'
                                        });
                                    }
                                }
                                break;
                            case "/rename":
                                // Checking for permission
                                if (checkRule(users[socket.id], 'rename')) {
                                    // Renaming user --> see rename()
                                    var result = rename(msg[1], msg[2]);

                                    // Checking return of rename()
                                    if (result) {
                                        socket.emit('chat', {
                                            zeit: new Date(),
                                            name: users[socket.id].username,
                                            text: 'The user has been renamed!'
                                        });
                                        log('[CHAT] User ' + msg[1] + ' has been renamed to ' + msg[2] + ' by ' + users[socket.id].username);

                                    } else {
                                        socket.emit('chat', {
                                            zeit: new Date(),
                                            name: users[socket.id].username,
                                            text: 'The user does not exist!'
                                        });
                                    }
                                }

                                break;
                            case "/mute":
                                // Checking for permissions
                                if (checkRule(users[socket.id], 'mute')) {
                                    // Muting user and analysing result --> see mute()
                                    if (mute(msg[1], msg[2])) {
                                        socket.emit('chat', {
                                            zeit: new Date(),
                                            text: 'The user was timeouted for ' + msg[2] + ' seconds!'
                                        });
                                        if (usernames[msg[1]]) {
                                            users[usernames[msg[1]]].socket.emit('chat', {
                                                zeit: new Date(),
                                                text: 'You were timeouted for ' + msg[2] + ' seconds!'
                                            });
                                        }
                                    } else {
                                        socket.emit('chat', {
                                            zeit: new Date(),
                                            text: 'There was an error filing your request!'
                                        });
                                    }
                                }
                                break;

                            case "/promote":
                                // Checking for permissions
                                if (checkRule(users[socket.id], 'promote')) {
                                    // Promoting user --> see promote()
                                    var result = promote(msg[1], msg[2]);

                                    // Checking result of promote()
                                    switch (result) {
                                        case "has_rank":
                                            socket.emit('chat', {
                                                zeit: new Date(),
                                                text: 'The user already has that rank!'
                                            });
                                            break;
                                        case "no_rank":
                                            socket.emit('chat', {
                                                zeit: new Date(),
                                                text: 'There is no such rank!'
                                            });
                                            break;
                                        case true:
                                            socket.emit('chat', {
                                                zeit: new Date(),
                                                text: 'The user ' + msg[1] + ' was promoted to ' + msg[2] + '!'
                                            });
                                            users[usernames[username]].socket.emit('chat', {
                                                zeit: new Date(),
                                                text: 'You were promoted to ' + msg[2] + '!'
                                            });

                                    }
                                }
                                break;
                            case "/name":
                                // Checking for permission
                                if (checkRule(users[socket.id], 'name')) {
                                    // Renaming user --> see name()
                                    name(users[socket.id].username, msg[1]);
                                }

                                break;
                            case "/stop":
                                mongoose.connection.close();


                                break;
                        }

                    } else {
                        // It's a chat message
                        io.sockets.emit('chat', {
                            zeit: new Date(),
                            name: users[socket.id].username,
                            text: data.text
                        });
                        log('[CHAT] User [' + socket.id + '] sent message : ' + data.text);
                    }
                } else {
                    // No completed handshake
                    socket.emit('chat', {
                        zeit: new Date(),
                        text: 'Handshake was not completed!'
                    });
                    log('[CHAT] User [' + socket.id + '] requested message. Handshake was not completed!');
                }
            } else if (check === 'ban') {
                // User is banned and avoided handshake??
            } else if (check === 'timeout') {
                // user is timeouted
                socket.emit('chat', {
                    zeit: new Date(),
                    text: 'You are timeouted for another ' + getTimeout(users[socket.id].username) + ' seconds'
                });
            }

        });
    });

    // Logging function
    function log(event) {

        // Getting timestamp
        var timestamp = new Date();

        // Creating log message
        var logging = '[' + timestamp.getHours() + ':' + timestamp.getMinutes() + '.' + timestamp.getSeconds() + '] ' + event;

        // Console logging and writing into file logs.txt
        console.log(logging);
        fs.appendFile('logs/logs.txt', logging + '\r\n', function (err) {
            if (err) {
                return console.log(err);
            }
        });
    }

    // ********* COMMAND FUNCTION SECTION **********

    // Baning function
    function ban(username) {

        // Adding user to banned users file
        banned.push(username);
        fs.appendFile('config/bans.txt', username + '\r\n', function (err) {
            if (err) {
                return console.log(err);

            }
            // Recheck bans
            checkBans();
        });
    }

    // Unbaning function
    function unban(username) {
        // Lookking through bans file and deleting user

        var count = banned.indexOf(username);
        banned.splice(count, 1);
        var data = fs.readFileSync('config/bans.txt').toString();

        var data_array = data.split('\r\n');

        function lastIndex(username) {
            for (var i = 0; i < data_array.length + 1; i++)
                if (data_array[i].match(username))
                    return i;
        }

        delete data_array[lastIndex(username)];
        var file = fs.createWriteStream('config/bans.txt');
        file.on('error', function (err) {
            log('[CORE] FS Reader failed at function unban using the banned user file. Error:' + err.toString());
        });
        data_array.forEach(function (v) {
            if (!v == "" || !v == 'undefined') {
                file.write(v + '\r\n');
            }
        });
        file.end();

    }

    // Renaming function 
    function rename(username, newname) {
        // Check if user exists
        if (!usernames[username]) {
            // He does not
            return false;
        } else {
            // He does

            // Editing his users object
            var userobj = users[usernames[username]];
            userobj.username = newname;
            users[usernames[username]] = userobj;

            // Reconfigurating mapping object
            usernames[newname] = userobj.socketid;
            delete usernames[username];

            // Telling the user
            users[usernames[newname]].socket.emit('chat', {
                zeit: new Date(),
                text: 'You have been renamed to ' + newname
            });

            // Successful
            return true;
        }
    }

    // Muting function
    function mute(username, time) {

        // use strict stuff
        time = bigInt(time);

        // Check if users is already timeouted
        if (timeout[username]) {
            return false;
        } else {

            // Getting timestamp --> see getTime()
            var mutetime = getTime();

            // Getting time in ms
            time = time * bigInt(1000);

            // Setting timeout variable
            timeout[username] = bigInt(mutetime + time);

            // Successful
            return true;
        }
    }

    // Promoting function
    function promote(username, rank) {
        // Check if rank exists
        if (ranks[rank]) {
            // Check if user has rank to prevent spam
            if (userranks[username] === rank) {
                return 'has_rank';
            } else {
                // Editing users file
                userranks[username] = rank;
                var newUsers = JSON.stringify(userranks);
                fs.writeFileSync('./config/users.json', newUsers);

                // Check if user is currently on server
                if (usernames[username]) {
                    // User is currently on server
                    users[usernames[username]].rank = Rank(rank);
                }
            }
        } else {
            return 'no_rank';
        }
    }

    function name(username, newname) {
        // Check if user exists
        if (!usernames[username]) {
            // He does not
            return false;
        } else {
            // He does

            // Editing his users object
            var userobj = users[usernames[username]];
            userobj.username = newname;
            users[usernames[username]] = userobj;

            // Reconfigurating mapping object
            usernames[newname] = userobj.socketid;
            delete usernames[username];

            // Telling the user
            users[usernames[newname]].socket.emit('chat', {
                zeit: new Date(),
                name: users[usernames[newname]].username,
                text: 'You have renamed yourself to ' + newname
            });

            // Successful
            return true;
        }
    }



    // ********* SUPPORT FUNCTION SECTION **********

    // Function for loading banned users from file
    function getBans() {
        log('[CHAT] Starting to load banned users');
        var count = 0;
        var instream = fs.createReadStream('./config/bans.txt'); // Opening bans.txt 
        var outstream = new(require('stream'))();
        var rl = readline.createInterface(instream, outstream);

        rl.on('line', function (line) {

            if (banned.indexOf(line) >= 0) {

            } else {
                banned.push(line);
                count = count + 1;
            }
        });
        rl.on('close', function (line) {
            log('[CHAT] Finished loading ' + count.toString() + ' banned users');
        });

    }

    // Going through banned array --> Disconnecting all banned users
    function checkBans() {

        // Quering through banned[]
        for (var f = 0; f < banned.length;) {

            // If banned name in mapping object exists
            if (usernames[banned[f]]) {

                users[usernames[banned[f]]].socket.emit('chat', {
                    zeit: new Date(),
                    text: 'You are banned from the server!'
                });

                // Disconnecting user
                users[usernames[banned[f]]].socket.disconnect('You were banned!');
                f++;
            } else {

                f++;
            }
        }

    }

    // Checking if user is timeouted
    function checkTimeout(username) {
        // Checking for timeout
        if (timeout[username]) {
            // Yes he is
            var time = getTime();

            // Check if timeout has run out
            if (time > timeout[username]) {
                delete timeout[username];

                // Timeout ran out
                return false;

            } else {
                // User is timeouted
                return true;

            }
        } else {
            // No timeout
            return false;

        }
    }

    // Getting rule for rank in rank file
    function getRule(rank, attr) {
        if (ranks[rank]['*'] || ranks[rank][attr]) {
            // User is allowed to do that 

            return true;
        } else {
            // User is not allowed to do that 

            return false;
        }
    }

    // Checking if user is allowed to do that
    function checkRule(user, rule) {
        if (user.rank[rule]) {
            // Yes he is

            return true;
        } else {
            // No he is not

            return false;
        }
    }

    // Checking if user has specific rank
    function getRank(username) {
        if (userranks.hasOwnProperty(username)) {
            // Yes he has --> returning name of rank

            return userranks[username];
        } else {
            // No he has not --> returning default rank

            return ranks.default;
        }
    }

    // Creating timestamp
    function getTime() {
        var date = new Date();

        // Creating variable with current time in milliseconds
        var timestamp = bigInt((parseInt(date.getFullYear()) * 31536000000) + (parseInt(date.getMonth()) * 2628000000) + (parseInt(date.getDay()) * 86400000) + (parseInt(date.getHours()) * 3600000) + (parseInt(date.getMinutes()) * 60000) + (parseInt(date.getSeconds()) * 1000) + parseInt(date.getMilliseconds()));
        return timestamp;
    }

    // Checking if user is banned
    function checkUserBan(username) {
        if (banned[username]) {
            // Yes he is

            return true;
        } else {
            // No he is not

            return false;
        }
    }

    // Checking status of user
    function checkUser(username) {

        // Checking if user is banned or timeouted
        var ban = checkUserBan(username);
        var timeOut = checkTimeout(username);
        // Analysing results
        if (ban && timeOut) {
            return 'ban';
        } else if (ban) {
            return 'ban';
        } else if (timeOut) {
            return 'timeout';
        } else {
            return true;
        }
    }

    // Getting time timeouted in s
    function getTimeout(username) {
        var timeouted = timeout[username];
        var timestamp = getTime();
        var time = 0;

        if (timeouted) {
            time = timeouted - timestamp;
            time = time / 1000;
            if (time > 0) {
                return time;
            } else {
                return 'no_timeout';
            }

        } else {
            return 'no_timeout'
        }
    }

    function makeid() {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

        for (var i = 0; i < 6; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }

    this.log = function (message) {
        log(message);
    }
}
Chat.prototype.log = function (message) {
    log(message);
};
module.exports = {
    Chat: Chat
};
