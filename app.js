require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3001; //fetching port from process variable
const client = require("./initDB");

//Routes for different end-points
const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const sellerRouter = require("./routes/seller");
const apiRouter = require("./routes/api");
const customerRouter = require("./routes/customer");
const registerRouter = require("./routes/register");

//Connection to Database
client
  .connect()
  .then(() => {
    console.log("Connected to MongoDB cluster successfully");
  })
  .catch((err) => {
    console.log(err);
  });

//Middlewares
app.use(express.json()); //to parse JSON requests
app.use(express.urlencoded({ extended: false })); //urlencoded requests with nested post object
app.use(express.static(path.join(__dirname, "public")));

//Routes
app.use("/", indexRouter);
app.use("/auth", authRouter);
app.use("/seller", sellerRouter);
app.use("/api", apiRouter);
app.use("/customer", customerRouter);
app.use("/register", registerRouter);

//Server start
app.listen(port, () => {
  console.log(`Server started at port: ${port}`);
});
