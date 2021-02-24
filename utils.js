const client = require("./initDB");
const ObjectId = require("mongodb").ObjectID;

const utils = {
  mergeCart: async (prvsCart, newCart) => {
    const productCollection = client
      .db(process.env.DB_NAME)
      .collection(process.env.PRO_COLL);
    let prvsCartIds = Object.keys(prvsCart).map((id) => new ObjectId(id));
    let newCartIds = Object.keys(newCart).map((id) => new ObjectId(id));

    console.log(prvsCartIds, newCartIds);

    let prvsCartProData = await productCollection
      .find({ _id: { $in: prvsCartIds } })
      .project({ pname: 1, quantity: 1, price: 1, imgUrls: 1, sellerId: 1 })
      .toArray();

    let newCartProData = await productCollection
      .find({ _id: { $in: newCartIds } })
      .project({ pname: 1, quantity: 1, price: 1, imgUrls: 1, sellerId: 1 })
      .toArray();

    let mergedCart = prvsCartProData;
    mergedCart.forEach((cartItem) => {
      cartItem.stock = cartItem.quantity;
      cartItem.quantity = prvsCart[cartItem._id];
    });
    let dbMergeCart = prvsCart;
    let newIds = [];
    if (newCart) {
      let commonIds = newCartIds.filter((newId) => {
        if (prvsCartIds.find((prevId) => prevId.equals(newId))) return true;
        newIds.push(newId);
        return false;
      });
      if (commonIds.length) {
        commonIds.forEach((id) => {
          let index = mergedCart.findIndex((cartItem) =>
            new ObjectId(cartItem._id).equals(id)
          );

          let pq = prvsCart[id];
          let nq = newCart[id];
          let stock = mergedCart[index].stock;
          let tempQuantity = pq + nq;

          if (tempQuantity > stock) tempQuantity = stock;
          mergedCart[index].quantity = tempQuantity;
          dbMergeCart[id] = tempQuantity;
        });
      }

      if (newIds.length) {
        newIds.forEach((newId) => {
          let index = newCartProData.findIndex((cartItem) =>
            new ObjectId(cartItem._id).equals(newId)
          );
          if (index !== -1) {
            newCartProData[index].stock = newCartProData[index].quantity;
            newCartProData[index].quantity = newCart[newIds];
            mergedCart.push(newCartProData[index]);
            dbMergeCart[newId] = newCart[newId];
          }
        });
      }
    } else {
      mergedCart.forEach((cartItem) => {
        cartItem.stock = cartItem.quantity;
        cartItem.quantity = prvsCart[cartItem._id];
      });
    }

    return { mergedCart, dbMergeCart };
  },
};

module.exports = utils;
