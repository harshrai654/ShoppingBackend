const express = require("express");
const router = express.Router();
const client = require("../initDB");
const jwt = require("jsonwebtoken");
const utils = require("../utils");

router.post("/", (req, res) => {
  const { token } = req.body;

  jwt.verify(token, process.env.SECRET, (err, decoded) => {
    if (err) {
      res.sendStatus(403);
      console.log("Invalid user");
    } else {
      res.json(decoded);
    }
  });
});

router.post("/login", function (req, res) {
  const { email, pass, cart } = req.body;

  if (email && pass) {
    const userCollection = client
      .db(process.env.DB_NAME)
      .collection(process.env.USER_COLL);

    const secretKey = process.env.SECRET;

    //Verifying credentials in DB
    userCollection
      .findOne({ email, pass })
      .then((dbData) => {
        if (dbData) {
          let newCart = dbData.cart;
          const payload = {
            name: dbData.name,
            email: dbData.email,
            _id: dbData._id,
          };

          utils.mergeCart(newCart, cart).then(({ mergedCart, dbMergeCart }) => {
            //Updating cart
            userCollection.updateOne(
              { _id: dbData._id },
              { $set: { cart: dbMergeCart } },
              (err, user) => {
                if (err) {
                  console.log("Cart update failed");
                  res.sendStatus(500);
                } else {
                  //Creating token
                  jwt.sign(
                    payload,
                    secretKey,
                    { expiresIn: "7d" },
                    (err, token) => {
                      if (err) res.sendStatus(500);
                      else {
                        console.log(`${payload._id} Logged in`);
                        res.json({
                          token,
                          cart: mergedCart,
                        });
                      }
                    }
                  );
                }
              }
            );
          });
        } else {
          console.log("Login failed");
          res.sendStatus(403);
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }
});

router.post("/sellerlogin", function (req, res) {
  const { email, pass } = req.body;

  if (email && pass) {
    const sellerCollection = client
      .db(process.env.DB_NAME)
      .collection(process.env.SELL_COLL);

    //Verifying credentials in DB

    sellerCollection
      .findOne({ email, pass })
      .then((dbData) => {
        if (dbData) {
          const payload = {
            name: dbData.name,
            email: dbData.email,
            _id: dbData._id,
          };
          //Creating token
          const secretKey = process.env.SECRET;

          jwt.sign(payload, secretKey, { expiresIn: "7d" }, (err, token) => {
            if (err) res.sendStatus(500);
            else {
              console.log(`${payload._id} Logged in`);
              res.json({
                token,
              });
            }
          });
        } else {
          console.log("Login failed");
          res.sendStatus(403);
        }
      })
      .catch((err) => {
        console.error(err);
      });
  }
});

module.exports = router;
