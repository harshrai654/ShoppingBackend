const express = require("express");
const router = express.Router();
const client = require("../initDB");
const jwt = require("jsonwebtoken");

router.post("/", (req, res) => {
  const { role, name, email, pass } = req.body.values;
  const collName = role ? process.env.SELL_COLL : process.env.USER_COLL;
  const doc = role
    ? { name, email, pass, order: [] }
    : { name, email, pass, order: [], cart: {} };
  const collection = client.db(process.env.DB_NAME).collection(collName);

  collection
    .findOneAndUpdate(
      { email },
      { $setOnInsert: doc },
      { upsert: true, returnOriginal: false }
    )
    .then((doc) => {
      //   console.log(doc);
      if (!doc.lastErrorObject.updatedExisting) {
        const dbData = doc.value;
        const id = dbData._id;
        console.log(`${id} created account`);

        const payload = {
          name: dbData.name,
          email: dbData.email,
          _id: dbData._id,
        };

        jwt.sign(
          payload,
          process.env.SECRET,
          { expiresIn: "7d" },
          (err, token) => {
            if (err) res.sendStatus(500);
            else {
              console.log(`${payload._id} Logged in`);
              res.json({
                token,
                name: dbData.name,
                cart: dbData.cart,
                order: dbData.order,
                type: role,
              });
            }
          }
        );
      } else {
        res.sendStatus(403);
        console.error("Email already exist!");
      }
    });
});

module.exports = router;
