const client = require("./initDB");
const ObjectId = require("mongodb").ObjectID; //ObjectID construtor function to get ObjectID from stringified id

const utils = {
  mergeCart: async (prvsCart, newCart) => {
    /**Structure of cart:
     * {ProductId:quantity}
     *
     **/

    const productCollection = client
      .db(process.env.DB_NAME)
      .collection(process.env.PRO_COLL);

    //Creating array of product ids with ObjectID constructor for saved cart and new cart
    let prvsCartIds = Object.keys(prvsCart).map((id) => new ObjectId(id));
    let newCartIds = Object.keys(newCart).map((id) => new ObjectId(id));

    //Fetching product data from id array using $in array operator of mongo
    let prvsCartProData = await productCollection
      .find({ _id: { $in: prvsCartIds } })
      .project({ pname: 1, quantity: 1, price: 1, imgUrls: 1, sellerId: 1 })
      .toArray();

    let newCartProData = await productCollection
      .find({ _id: { $in: newCartIds } })
      .project({ pname: 1, quantity: 1, price: 1, imgUrls: 1, sellerId: 1 })
      .toArray();

    //initialising new cart with previous cart data with corresponding products
    let mergedCart = prvsCartProData;

    //Adding customer's quantity to the cart's product data
    mergedCart.forEach((cartItem) => {
      cartItem.stock = cartItem.quantity;
      cartItem.quantity = prvsCart[cartItem._id];
    });

    /*Maintaining two carts -
     {
      mergedCart:(to be sent as response, contains product data also),
      dbMergeCart:(contains db cart structure specified at the start of this code)
    }
    */

    //merged db cart with prvs cart
    let dbMergeCart = prvsCart;
    let newIds = [];
    if (newCart) {
      //Getting common products ids from previous and new cart
      let commonIds = newCartIds.filter((newId) => {
        if (prvsCartIds.find((prevId) => prevId.equals(newId))) return true;

        //Storing new products from customer's current cart
        newIds.push(newId);
        return false;
      });

      if (commonIds.length) {
        commonIds.forEach((id) => {
          let index = mergedCart.findIndex((cartItem) =>
            new ObjectId(cartItem._id).equals(id)
          );

          //Updating quantity of previous cart item with check for current stock
          //Quantity > stock => quantity = stock
          let pq = prvsCart[id];
          let nq = newCart[id];
          let stock = mergedCart[index].stock;
          let tempQuantity = pq + nq;

          if (tempQuantity > stock) tempQuantity = stock;

          //setting new quantity with mergerdCart and dbCart
          mergedCart[index].quantity = tempQuantity;
          dbMergeCart[id] = tempQuantity;
        });
      }

      if (newIds.length) {
        //Adding new products from new cart ids by searching it over porduct's data
        newIds.forEach((newId) => {
          let index = newCartProData.findIndex((cartItem) =>
            new ObjectId(cartItem._id).equals(newId)
          );
          if (index !== -1) {
            newCartProData[index].stock = newCartProData[index].quantity;
            newCartProData[index].quantity = newCart[newIds];
            mergedCart.push(newCartProData[index]);

            //Adding new product ids and its quantity to db merged Cart
            dbMergeCart[newId] = newCart[newId];
          }
        });
      }
    }
    // } else {
    //   mergedCart.forEach((cartItem) => {
    //     cartItem.stock = cartItem.quantity;
    //     cartItem.quantity = prvsCart[cartItem._id];
    //   });
    // }

    return { mergedCart, dbMergeCart };
  },

  createProductData: (productData, sellerData, urls) => {
    return {
      pname: productData.pname,
      desc: productData.desc,
      category: productData.category,
      price: parseFloat(productData.price),
      quantity: parseInt(productData.quantity),
      sellerId: sellerData._id,
      imgUrls: urls,
    };
  },

  //A verification middleware to bind token in request header with request object
  verify: (req, res, next) => {
    const bearerHeader = req.headers["authorization"];
    if (bearerHeader) {
      const bearer = bearerHeader.split(" ");
      const bearerToken = bearer[1];
      req.token = bearerToken;
      next();
    } else {
      res.sendStatus(403);
    }
  },
};

module.exports = utils;
