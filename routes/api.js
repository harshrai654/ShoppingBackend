const express = require("express");
const router = express.Router();
const client = require("../initDB");

router.get("/products", function (req, res) {
  const productsCollection = client
    .db(process.env.DB_NAME)
    .collection(process.env.PRO_COLL);

  productsCollection
    .find({})
    .toArray()
    .then((products) => {
      //   console.log(products);
      if (products.length) {
        res.json(products);
        console.log("Products sent!");
      } else {
        res.json([]);
      }
    });
});

router.get("/categories", (req, res) => {
  const productsCollection = client
    .db(process.env.DB_NAME)
    .collection(process.env.PRO_COLL);

  productsCollection.distinct("category").then((doc) => {
    res.json({ cats: doc });
  });
});

module.exports = router;
