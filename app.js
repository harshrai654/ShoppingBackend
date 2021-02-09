require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const indexRouter = require("./routes/index");
const app = express();
const port = process.env.PORT || 3001;
const client = require("./initDB");

//Connection yo Database
client
  .connect()
  .then(() => {
    console.log("Connected to MongoDB cluster successfully");
  })
  .catch((err) => {
    console.log(err);
  });

//Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

//Routes
app.use("/", indexRouter);

//Server start
app.listen(port, () => {
  console.log(`Server started at port: ${port}`);
});
