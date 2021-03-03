//Route for handling login of customer and seller

const express = require("express");
const router = express.Router();
const client = require("../initDB");
const jwt = require("jsonwebtoken");
const utils = require("../utils");

//An auth handler to only verify token
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
  const { email, pass, cart } = req.body; //getting user details from requests

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
          let newCart = dbData.cart; //previous saved user cart
          const uname = dbData.name;

          //data for token
          const payload = {
            name: dbData.name,
            email: dbData.email,
            _id: dbData._id, //will be considered as customer id
          };

          //A utility function to merge current cart from the request and previous cart from the DB
          //utils.mergeCart is a Asynchronous function
          utils.mergeCart(newCart, cart).then(({ mergedCart, dbMergeCart }) => {
            //getting mergedCart aaray to be sent as response
            //dbMergeCart is cart array to be saved in DB
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

                        //sending created token cart, user-name and previous orders
                        res.json({
                          token,
                          uname,
                          cart: mergedCart,
                          order: dbData.order,
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
        res.sendStatus(403);
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
        res.sendStatus(403);
      });
  }
});

module.exports = router;
