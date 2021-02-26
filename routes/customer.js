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

router.post("/checkout", verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      const customerId = new ObjectId(tokenData._id);
      let orderDataCustomer = [];
      const cart = req.body.cart;
      const productCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.PRO_COLL);

      const userCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.USER_COLL);

      const sellerCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.SELL_COLL);

      const at = new Date();
      cart.forEach((cartItem) => {
        const orderData = {
          orderId: new ObjectId(),
          _id: cartItem._id,
          quantity: cartItem.quantity,
          price: cartItem.price,
          amount: cartItem.price * cartItem.quantity,
          at,
          delivered: false,
        };
        orderDataCustomer.push(orderData);

        sellerCollection
          .findOneAndUpdate(
            { _id: new ObjectId(cartItem.sellerId) },
            {
              $push: {
                order: { ...orderData, customerId },
              },
            }
          )
          .then((doc) => {
            const seller = doc.value;
            console.log(`Seller ${seller._id} got order`);
          });

        productCollection
          .findOneAndUpdate(
            { _id: new ObjectId(cartItem._id) },
            { $inc: { quantity: -cartItem.quantity } }
          )
          .then((doc) => {
            console.log(
              `Product ${doc.value._id} purchased X${cartItem.quantity}`
            );
          })
          .catch((err) => {
            console.error(err);
          });
      });

      userCollection
        .findOneAndUpdate(
          { _id: customerId },
          {
            $set: { cart: [] },
            $push: { order: { $each: orderDataCustomer } },
          },
          { returnOriginal: false }
        )
        .then((doc) => {
          const user = doc.value;
          res.json({
            orders: user.order,
            cart: { items: user.cart, order: { amount: 0 } },
          });
          console.log(`User ${user._id} placed an order.`);
        })
        .catch((err) => {
          console.error(err);
        });
    }
  });
});

router.get("/orders", verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      const customerId = new ObjectId(tokenData._id);
      const userCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.USER_COLL);
      const productCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.PRO_COLL);

      userCollection
        .findOne({ _id: customerId }, { projection: { _id: 0, order: 1 } })
        .then((doc) => {
          const orders = doc.order;
          const orderData = [];
          const orderPromises = [];
          orders.forEach((order) => {
            orderPromises.push(
              productCollection
                .findOne(
                  { _id: new ObjectId(order._id) },
                  { projection: { _id: 0, pname: 1, imgUrls: { $slice: 1 } } }
                )
                .then((doc) => {
                  console.log(doc, order);
                  orderData.push({
                    ...doc,
                    ...order,
                  });
                })
                .catch((err) => {
                  console.error(err);
                  res.sendStatus(403);
                })
            );
          });

          Promise.all(orderPromises).then(() => {
            res.json(orderData);
          });
        })
        .catch((err) => {
          console.error(err);
          res.sendStatus(403);
        });
    }
  });
});

module.exports = router;
