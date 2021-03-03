const express = require("express");
const router = express.Router();
const client = require("../initDB");
const jwt = require("jsonwebtoken");

router.post("/", (req, res) => {
  //Getting form data
  const { role, name, email, pass } = req.body.values;

  //Getting collection with respect to customer or seller
  const collName = role ? process.env.SELL_COLL : process.env.USER_COLL;
  const doc = role
    ? { name, email, pass, order: [] }
    : { name, email, pass, order: [], cart: {} };
  const collection = client.db(process.env.DB_NAME).collection(collName);

  //Adding new document with upsert option and uniqueness of email
  collection
    .findOneAndUpdate(
      { email },
      { $setOnInsert: doc },
      { upsert: true, returnOriginal: false }
    )
    .then((doc) => {
      //If email is uniuque
      if (!doc.lastErrorObject.updatedExisting) {
        const dbData = doc.value;
        const id = dbData._id;
        console.log(`${id} created account`);

        //Creating token and initiating login action
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
                cart: [], //Initial empty cart
                order: dbData.order, //Initial empty object
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
