const mongoose = require('mongoose');

const connectToMongo = (mongURI , route) => {
    return mongoose.connect(mongURI).then(() => {
        console.log("Connection to MongoDB successful : ",route);
    }).catch((err) => {
        console.error("Error connecting to MongoDB:", err);
        throw err; // Re-throw the error to propagate it to the caller
    });
}

mongoose.set('strictQuery', true);

module.exports = connectToMongo;
