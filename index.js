const express = require('express')
const app = express()
const port = 5000
const cors = require("cors")
const routes = require("./routes/")
const connectToMongo = require('./db')
require("dotenv").config()
app.use(express.json())
app.use(cors({
  origin : "*"
}))

app.use(express.json({ limit: '100mb' })); // JSON payload limit
app.use(express.urlencoded({ limit: '100mb', extended: true,parameterLimit: 100000000 }));
app.use('/api', routes);

const mongoUri = process.env.MONGO_URI
connectToMongo(mongoUri,"todo")
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

app.get("/",(req,res) => {
  res.send({"message" : "KB's Todo Server Says : - Hello"})
})


