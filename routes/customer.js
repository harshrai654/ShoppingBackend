const express = require("express");
const router = express.Router();
const client = require("../initDB");
const jwt = require("jsonwebtoken");
const ObjectId = require("mongodb").ObjectId;
const utils = require("../utils");

//for handling cart updates -{quantity change ,delete,add}
router.post("/cart", utils.verify, function (req, res) {
  //verifying token with private key
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      //Forbidden if token is invalid
      res.sendStatus(403);
    } else {
      const userCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.USER_COLL);

      const user = tokenData;
      const cart = req.body.cart; //fetching updated cart from request
      userCollection.findOneAndUpdate(
        { _id: new ObjectId(user._id) },
        { $set: { cart: cart } }, //setting cart to new cart
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

//checkout handler
/**Checkout needs to update all three collection
 * Product -> to update qunatity
 * Seller -> to add new order to orders array
 * Customer -> to flush cart and and the order to orders array
 */
router.post("/checkout", utils.verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      const customerId = new ObjectId(tokenData._id);
      let orderDataCustomer = [];
      const cart = req.body.cart; //getting cart from request

      //Getting all three collections
      const productCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.PRO_COLL);

      const userCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.USER_COLL);

      const sellerCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.SELL_COLL);

      //Adding date to order items
      const at = new Date();

      cart.forEach((cartItem) => {
        const orderData = {
          orderId: new ObjectId(), //Adding a unique orderid for each order
          _id: cartItem._id,
          quantity: cartItem.quantity,
          price: cartItem.price,
          amount: cartItem.price * cartItem.quantity,
          at,
          delivered: false,
        };
        orderDataCustomer.push(orderData); //pushing order item to order's array

        //Adding orders to seller's collection
        sellerCollection
          .findOneAndUpdate(
            { _id: new ObjectId(cartItem.sellerId) },
            {
              $push: {
                order: { ...orderData, customerId }, //adding customer's id to orders
              },
            }
          )
          .then((doc) => {
            const seller = doc.value;
            console.log(`Seller ${seller._id} got order`);
          });

        //Updating product's quantitiy using $inc operator of mongo
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

      //Adding orders to user's collection
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

          //Sending order data and cart as  reponse
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

//Handler to send previous orders
router.get("/orders", utils.verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      //Token from request
      const customerId = new ObjectId(tokenData._id);
      const userCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.USER_COLL);

      //Order array of user containes product id which can be used to get more details about the product
      const productCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.PRO_COLL);

      userCollection
        .findOne({ _id: customerId }, { projection: { _id: 0, order: 1 } })
        .then((doc) => {
          //Svaed orders
          const orders = doc.order;
          const orderData = [];

          //Promise array to save all pending promises of each product data retrieval
          const orderPromises = [];
          orders.forEach((order) => {
            //Pushing each promise
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

          //Sending Product data associated with user's order array
          // after getting all products data from DB
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
