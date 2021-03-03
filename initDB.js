const { MongoClient } = require("mongodb");

//URI for mongodb atlas cluster
const uri = `mongodb+srv://spider:${process.env.DB_PASS}@shoppingcluster.ogvk4.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useUnifiedTopology: true });

module.exports = client;
