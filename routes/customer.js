const express = require("express");
const router = express.Router();
const client = require("../initDB");
const jwt = require("jsonwebtoken");
const ObjectId = require("mongodb").ObjectId;

const verify = (req, res, next) => {
  const bearerHeader = req.headers["authorization"];
  if (bearerHeader) {
    const bearer = bearerHeader.split(" ");
    const bearerToken = bearer[1];
    req.token = bearerToken;
    next();
  } else {
    res.sendStatus(403);
  }
};

router.post("/cart", verify, function (req, res) {
  console.log("cart update");
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      console.log(req.body, tokenData);
      const userCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.USER_COLL);
      const user = tokenData;
      const cart = req.body.cart;
      userCollection.findOneAndUpdate(
        { _id: new ObjectId(user._id) },
        { $set: { cart: cart } },
        (err, doc) => {
          if (err) {
            console.error(err);
            res.sendStatus(500);
          } else {
            console.log(doc);
            res.sendStatus(200);
          }
        }
      );
    }
  });
});

module.exports = router;
