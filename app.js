require("dotenv").config();
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const indexRouter = require("./routes/index");
const authRouter = require("./routes/auth");
const sellerRouter = require("./routes/seller");
const apiRouter = require("./routes/api");
const customerRouter = require("./routes/customer");
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
app.use("/auth", authRouter);
app.use("/seller", sellerRouter);
app.use("/api", apiRouter);
app.use("/customer", customerRouter);

//Server start
app.listen(port, () => {
  console.log(`Server started at port: ${port}`);
});
