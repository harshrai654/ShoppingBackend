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
      } else {
        res.json([]);
      }
    });
});

module.exports = router;
