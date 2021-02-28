const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer");
const upload = multer();
const client = require("../initDB");
const { Storage } = require("@google-cloud/storage");
const { ObjectId } = require("mongodb");
const { send } = require("process");

const gc = new Storage({
  keyFilename: path.join(__dirname, "../shopping-304613-5ced82ccf1fd.json"),
  projectId: "shopping-304613",
});

const imgsBucket = gc.bucket(process.env.BUCKET);

const createProductData = (productData, sellerData, urls) => {
  return {
    pname: productData.pname,
    desc: productData.desc,
    category: productData.category,
    price: parseFloat(productData.price),
    quantity: parseInt(productData.quantity),
    sellerId: sellerData._id,
    imgUrls: urls,
  };
};

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

router.post("/product", verify, upload.array("images"), function (req, res) {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      const files = req.files;
      const fileNamePrefix = tokenData._id + req.body.pname;
      let fileUrls = [],
        promises = [];
      files.forEach((file) => {
        const name = fileNamePrefix + Date.now();
        const imgFile = imgsBucket.file(name);
        const imgStream = imgFile.createWriteStream({
          metadata: {
            contentType: file.mimetype,
          },
        });
        imgStream.end(file.buffer);

        promises.push(
          new Promise((resolve, reject) => {
            imgStream.on("error", (error) => {
              console.log(
                "Something is wrong! Unable to upload at the moment." + error
              );
              reject();
            });

            imgStream.on("finish", () => {
              const url = `https://storage.googleapis.com/${imgsBucket.name}/${imgFile.name}`; //image url from firebase server
              fileUrls.push(url);
              resolve();
            });
          })
        );
      });
      //After all images are uploaded
      Promise.all(promises)
        .then(() => {
          const productData = createProductData(req.body, tokenData, fileUrls);

          const productsCollection = client
            .db(process.env.DB_NAME)
            .collection(process.env.PRO_COLL);

          productsCollection
            .insertOne(productData)
            .then((insertedProduct) => {
              console.log(
                `Product: ${insertedProduct.insertedId} | Added by Seller: ${tokenData._id}`
              );

              res.sendStatus(200);
            })
            .catch((err) => console.error(err));
        })
        .catch((err) => console.error(err));
    }
  });
});

router.get("/list", verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      const productsCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.PRO_COLL);

      productsCollection
        .find({ sellerId: tokenData._id })
        .toArray()
        .then((docs) => {
          if (!docs) {
            console.error(err);
          } else {
            res.json({
              products: docs,
            });
          }
        });
    }
  });
});

router.post("/update", verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res, sendStatus(403);
    } else {
      // console.log(tokenData, req.body.product);
      const productId = new ObjectId(req.body.product._id);
      const product = { ...req.body.product, _id: productId };
      const sellerId = tokenData._id;

      const productsCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.PRO_COLL);

      productsCollection
        .findOneAndUpdate(
          { _id: productId, sellerId },
          { $set: product },
          { returnOriginal: false }
        )
        .then((doc) => {
          console.log(doc);
          res.json({ product: doc.value });
        })
        .catch((err) => {
          console.error(err);
          res.sendStatus(403);
        });
    }
  });
});

router.get("/orders", verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.statusCode(403);
    } else {
      const sellerId = new ObjectId(tokenData._id);
      const sellerCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.SELL_COLL);
      const productCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.PRO_COLL);
      const userCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.USER_COLL);

      sellerCollection
        .findOne({ _id: sellerId }, { projection: { _id: 0, order: 1 } })
        .then((doc) => {
          const orders = doc.order;
          const orderDataArray = [];
          const orderPromises = [];
          orders.forEach((order) => {
            let orderData = { ...order };
            orderPromises.push(
              productCollection
                .findOne(
                  { _id: new ObjectId(order._id) },
                  { projection: { _id: 0, pname: 1, imgUrls: { $slice: 1 } } }
                )
                .then((product) => {
                  orderData = { ...orderData, ...product };
                  return userCollection.findOne({ _id: order.customerId });
                })
                .then((cust) => {
                  const { name, email } = cust;
                  orderData = { ...orderData, name, email };
                  orderDataArray.push(orderData);
                })
                .catch((err) => {
                  console.error(err);
                  res.sendStatus(403);
                })
            );
          });

          Promise.all(orderPromises).then(() => {
            res.json(orderDataArray);
          });
        })
        .catch((err) => {
          console.error(err);
          res.sendStatus(403);
        });
    }
  });
});

router.post("/orderupdate", verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      let { orderId, customerId, status } = req.body;
      orderId = new ObjectId(orderId);
      customerId = new ObjectId(customerId);
      const sellerId = new ObjectId(tokenData._id);

      const sellerCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.SELL_COLL);

      const userCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.USER_COLL);

      let statusArray = [];

      statusArray.push(
        sellerCollection.findOneAndUpdate(
          { _id: sellerId, order: { $elemMatch: { orderId } } },
          { $set: { "order.$.delivered": status } }
        )
      );

      statusArray.push(
        userCollection.findOneAndUpdate(
          { _id: customerId, order: { $elemMatch: { orderId } } },
          { $set: { "order.$.delivered": status } }
        )
      );

      Promise.all(statusArray)
        .then(() => {
          res.sendStatus(200);
        })
        .catch((err) => {
          console.log(err);
          res.sendStatus(403);
        });
    }
  });
});

module.exports = router;
