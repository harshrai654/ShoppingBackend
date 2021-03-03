const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer"); //multer library is used to parse multi-part form data
const utils = require("../utils");
const upload = multer();
const client = require("../initDB");
const { Storage } = require("@google-cloud/storage"); //Storing new product images in google cloud

const { ObjectId } = require("mongodb");

//API key file of GC
const gc = new Storage({
  keyFilename: path.join(__dirname, "../shopping-304613-5ced82ccf1fd.json"),
  projectId: "shopping-304613",
});

//Bucket inside GC where image files will be stored
const imgsBucket = gc.bucket(process.env.BUCKET);

router.post(
  "/product",
  utils.verify, //custom middleware to append token to request
  upload.array("images"), //multer middleware to append files to request object
  function (req, res) {
    jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
      if (err) {
        res.sendStatus(403);
      } else {
        const files = req.files; //getting image files
        const fileNamePrefix = tokenData._id + req.body.pname; //prefix of image file names

        //File urls array to be populated after iploading
        let fileUrls = [],
          //Pending Promises array for separare image files
          promises = [];

        //Iterating each image file
        files.forEach((file) => {
          const name = fileNamePrefix + Date.now();
          const imgFile = imgsBucket.file(name); //creating a file object with imageBucket object

          //Creating a writestream
          const imgStream = imgFile.createWriteStream({
            metadata: {
              contentType: file.mimetype,
            },
          });

          imgStream.end(file.buffer); //Wrting file data on to the stream

          //Pushing each image upload promise
          promises.push(
            new Promise((resolve, reject) => {
              imgStream.on("error", (error) => {
                console.log(
                  "Something is wrong! Unable to upload at the moment." + error
                );
                reject();
              });

              //On upload of each image file
              imgStream.on("finish", () => {
                const url = `https://storage.googleapis.com/${imgsBucket.name}/${imgFile.name}`; //image url from GC server
                fileUrls.push(url); //creating image url's array
                resolve();
              });
            })
          );
        });
        //After all images are uploaded
        //Inserting product with imgUrls field
        Promise.all(promises)
          .then(() => {
            const productData = utils.createProductData(
              req.body,
              tokenData,
              fileUrls
            );

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
  }
);

//Handler for fetching products added by the seller
router.get("/list", utils.verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      const productsCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.PRO_COLL);

      //Querying Product collection having given sellerId
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

//Updating details regarding a product
router.post("/update", utils.verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res, sendStatus(403);
    } else {
      //Getting product and seller id and updated product data from request
      const productId = new ObjectId(req.body.product._id);
      const product = { ...req.body.product, _id: productId };
      const sellerId = tokenData._id;

      const productsCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.PRO_COLL);

      //Updating product and fetching updated product back from db by using returnOriginal:false option
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

//Handler to get all orders seller has received
router.get("/orders", utils.verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.statusCode(403);
    } else {
      //Fetching seller id
      const sellerId = new ObjectId(tokenData._id);

      //Getting seller collection to get orders array field from DB
      const sellerCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.SELL_COLL);

      //Getting product collection to fetch product details from productId inside order's element
      const productCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.PRO_COLL);

      //Getting user's details from user's id in order's element
      const userCollection = client
        .db(process.env.DB_NAME)
        .collection(process.env.USER_COLL);

      //Fetching orders array
      sellerCollection
        .findOne({ _id: sellerId }, { projection: { _id: 0, order: 1 } })
        .then((doc) => {
          const orders = doc.order;

          //creating orderdataArray with each element conataing order+product+user details
          const orderDataArray = [];

          //promise array to be used when all promises are resolved
          const orderPromises = [];

          orders.forEach((order) => {
            //orderData variable to be used to add further user and product details
            let orderData = { ...order };

            orderPromises.push(
              //Getting product data and then user's data
              productCollection
                .findOne(
                  { _id: new ObjectId(order._id) },

                  //Using projection to get desired data [getting only one image url form the array by using $slice operator]
                  { projection: { _id: 0, pname: 1, imgUrls: { $slice: 1 } } }
                )
                .then((product) => {
                  orderData = { ...orderData, ...product };
                  return userCollection.findOne({ _id: order.customerId });
                })
                .then((cust) => {
                  const { name, email } = cust;
                  orderData = { ...orderData, name, email };
                  orderDataArray.push(orderData); //updating tthe orderDataArray
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

//Handler to update delivery status in seller as well as user collection
router.post("/orderupdate", utils.verify, (req, res) => {
  jwt.verify(req.token, process.env.SECRET, (err, tokenData) => {
    if (err) {
      res.sendStatus(403);
    } else {
      //Getting orderId,customerId and sellerId
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

      //Promise array to keep track of updation in both seller as well as user collection
      let statusArray = [];

      //Use of $elemMatch operator to update a single order element from orders array by finding it out using orderId

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
