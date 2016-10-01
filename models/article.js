var mongoose = require('mongoose');
var random = require('mongoose-simple-random');

var Schema = mongoose.Schema;

// create a schema
var articleSchema = new Schema({
    code: {
        type: String,
        unique: true
    },
    creator: String,
    title: String,
    content: String,
    created_at: Date,
    categories: [],
    image: String,
    id: Number,
    published: String
}, {
    collection: 'article'
});

articleSchema.plugin(random);

module.exports = {
    article: articleSchema
};
