const mongoose = require('mongoose');

const StockSchema = new mongoose.Schema({
    product: {
        type: String,
    },
    warehouse: {
        type: String,
    },
    stock: {
        type: Array,
        stock: {
            unit: {
                type: String,
            },
            amount: {
                type: Number
            }
        }
    }
}, {
    versionKey: false
});

const Stock = mongoose.model('Stock', StockSchema);
module.exports = Stock;
