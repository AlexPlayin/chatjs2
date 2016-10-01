var express = require('express')
,   app = express()
,   chatapp = express()
,   chatserver = require('http').createServer(chatapp)
,   server = require('http').createServer(app)
,   io = require('socket.io').listen(chatserver)
,   fs = require('fs')
,   readline = require('readline')
,   conf = require('./config/config.json');

var users = {};
var usernames = {};

//User-Class Constructor
function User(username, socketid, mysocket){
    var user = {'username': username, 'socketid': socketid, 'socket': mysocket};
    return user;
}

function Rank(id) {
    this.rankid = id;
}

var banned = [];

function getBans() {
    log('[CHAT] Starting to load banned users');
    var count = 0;
  var instream = fs.createReadStream('./config/bans.txt');
      var  outstream = new (require('stream'))();
   var rl = readline.createInterface(instream, outstream);
    
    rl.on('line', function (line) {
  
        if(banned.indexOf(line) >= 0) {
            
        }else {
            banned.push(line);
            count = count + 1;
 }
    });
     rl.on('close', function (line) {
         log('[CHAT] Finished loading ' + count.toString() + ' banned users');
    });
   
}

// Webserver
// auf den Port x schalten
server.listen(conf.siteport);
chatserver.listen(conf.chatport);

getBans();

app.use(express.static(__dirname + '/public'));

// wenn der Pfad / aufgerufen wird
app.get('/', function (req, res) {
	// so wird die Datei index.html ausgegeben
	res.sendfile(__dirname + '/public/index.html');
});

// Websocket
io.sockets.on('connection', function (socket) {
	// der Client ist verbunden
    
	socket.emit('chat', { zeit: new Date(), text: 'Connecting...' });

    socket.on('disconnect', function () {
       var index = users[socket.id];
        var id = socket.id;
        if (index) {
           // users.splice(index, 1);
            delete users[socket.id];
            log('[CORE] User with ID ' + id + ' disconnected');
        }
        
    });
    
    socket.on('handshake', function (data) {
         if(banned.indexOf(data.username) >= 0) { 
         log('[CHAT] Banned user '+ data.username + ' tried to connect');
         socket.emit('chat', { zeit: new Date(), text: 'You are banned from the server!'});
             socket.disconnect('You are banned!');
         } else {
        
        var newuser = User(data.username, socket.id, socket);
        usernames[data.username] = socket.id;
        users[socket.id] = newuser;
        log('[CHAT] Handshake for User ' + socket.id + ' completed');
             }
    });
    
    socket.on('status', function (data) {
       if (users[socket.id]) {
           socket.emit('chat', { zeit: new Date(), text: 'Connection successful'});
        log('[CHAT] User [' + socket.id + '] requested status: Handshake ok');
       }else{
           socket.emit('chat', { zeit: new Date(), text: 'Connection refused: no_handshake'});
        log('[CHAT] User [' + socket.id + '] requested status: No handshake');
       } 
    });

    log('[CORE] New user with ID ' + socket.id + ' trying to connect');
	// wenn ein Benutzer einen Text senden
	socket.on('chat', function (data) {
		// so wird dieser Text an alle anderen Benutzer gesendet
		if(users[socket.id]) {
            var msg = data.text.toString().split(" ");
        
        if(msg[0].indexOf('/') > -1) {
            switch (msg[0]) {
                case "/ban":
                   if(banned.indexOf(msg[1]) >= 0) {
                       socket.emit('chat', { zeit: new Date(), text: 'The user is already banned!' })
                   } else {
                       ban(msg[1]);
                   }
                    break;
                case "/unban":
                    
                    if(banned.indexOf(msg[1]) >= 0) {
                       
                   } else {
                       socket.emit('chat', { zeit: new Date(), text: 'The user is not banned!' });
                   }
                    unban(msg[1]);
                    
                    break;
            }
            
        }else{
        
        io.sockets.emit('chat', { zeit: new Date(), name: users[socket.id].username, text: data.text });
        log('[CHAT] User [' + socket.id + '] sent message : ' + data.text);
            }
        }else{
            socket.emit('chat', { zeit: new Date(), text: 'Handshake was not completed!' });
            log('[CHAT] User [' + socket.id + '] requested message. Handshake was not completed!');
        }
	});
});

// Portnummer in die Konsole schreiben
log('[CORE] Server is starting');
log('[CORE] Webserver reachable under http://127.0.0.1:' + conf.siteport + '/');
log('[CORE] Chat server reachable under http://127.0.0.1:' + conf.chatport + '/');

function log (event) {
    
    var timestamp = new Date();
    
    logging = '[' + timestamp.getHours() + ':' + timestamp.getMinutes() + '.' + timestamp.getSeconds() + '] ' + event; 
    
    console.log(logging);
    fs.appendFile('logs/logs.txt', logging + '\r\n', function(err) {
        if(err) {
            return console.log(err);
        }
    });   
}

//Command- Functions


function ban (username) {
    
    banned.push(username);
    fs.appendFile('config/bans.txt', username + '\r\n', function(err) {
        if(err) {
            return console.log(err);
       
        }
        checkBans();
    }); 
}

function unban (username) {
    var count = banned.indexOf(username);
    banned.splice(count,1);
    var data = fs.readFileSync('config/bans.txt').toString();
    
        console.log(data);
    var data_array = data.split('\r\n');

     function lastIndex (username){
        for (var i = 0; i < data_array.length + 1; i++)
        if (data_array[i].match(username))
            return i;
    }

    delete data_array[lastIndex(username)];
    var file = fs.createWriteStream('config/bans.txt');
    file.on('error', function(err) { /* error handling */ });
    data_array.forEach(function(v) { file.write(v + '\r\n'); });
    file.end();
    
}


//Support Functions

function checkBans() {
    
    for (f = 0; f < banned.length;) {
                    
        console.log(banned[f]);
        if (usernames[banned[f]]) {

                       

            users[usernames[banned[f]]].socket.emit('chat', { zeit: new Date(), text: 'You are banned from the server!'});
            users[usernames[banned[f]]].socket.disconnect('You were banned!');
            f++;
        }else {
            
            console.log("a user was not found!");
            f++;
        }
    }
    
}




