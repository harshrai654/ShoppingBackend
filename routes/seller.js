const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const path = require("path");
const multer = require("multer");
const upload = multer();
const client = require("../initDB");
const { Storage } = require("@google-cloud/storage");

const gc = new Storage({
  keyFilename: path.join(__dirname, "../shopping-304613-5ced82ccf1fd.json"),
  projectId: "shopping-304613",
});

const imgsBucket = gc.bucket(process.env.BUCKET);

const createProductData = (productData, sellerData, urls) => {
  return {
    pname: productData.pname,
    desc: productData.desc,
    price: parseFloat(productData.price),
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

module.exports = router;
