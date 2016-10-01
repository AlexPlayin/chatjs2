var random = require('mongoose-simple-random');
var mongoose = require('mongoose');

var Schema = mongoose.Schema;

// create a schema
var userSchema = new Schema({
    username: {
        type: String,
        unique: true
    },
    password: String,
    token: String,
    rank: String,
    created_at: Date,
    last_login: Date,
    article_posted: Number,
    fullname: String,
    class: String
}, {
    collection: 'users'
});

userSchema.plugin(random);

module.exports = {
    user: userSchema
};
