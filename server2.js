var express = require('express'),
    chatio = require('./chat-io-server'),
    chat = chatio.Chat(8080),
    app = express(),
    server = require('http').createServer(app),
    mongoose = require('mongoose'),
    parser = require('body-parser'),
    conf = require('./config/config.json');

// Webserver
// auf den Port x schalten
server.listen(3000);

mongoose.connect('mongodb://localhost/chatjs');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log("[REGISTER] Mongoose Connection established!");
});


var Schema = mongoose.Schema;

// create a schema
var userSchema = new Schema({
    username: String,
    password: String,
    token: String
}, {
    collection: 'users'
});

// the schema is useless so far
// we need to create a model using it
var User = mongoose.model('users', userSchema);
app.use(parser.urlencoded({
    extended: true
}));



app.use(express.static(__dirname + '/public'));


app.post('/login/post', function (req, res) {

    var token = '';

    require('crypto').randomBytes(48, function (err, buffer) {
        token = buffer.toString('hex');
    });
    var username = req.body.username;
    var password = req.body.password;

    User.findOne({
        username: username
    }, function (err, doc) {
        if (doc.password === password) {
            // User is correct
            doc.token = token;

            doc.save();

            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                success: 1,
                message: 'Logged in successful',
                token: token,
                username: username
            }));

        } else {
            // User is incorrect
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({
                success: 0,
                message: 'Wrong credentials',
            }));
        }
    });

});

app.post('/register/post', function (req, res) {

    var username = req.body.username;
    var password = req.body.password;

    var newUser = User({
        username: username,
        password: password,
        token: ""
    });

    newUser.save(function (err) {
        if (err) throw err;

        console.log('[REGISTER] New user ' + username + ' was created.');
    });

});
// wenn der Pfad / aufgerufen wird
app.get('/', function (req, res) {
    // so wird die Datei index.html ausgegeben
    res.sendfile(__dirname + '/public/index.html');
});

function getRandom() {


}
