const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    id: {
        type: String,
        unique: true
    },
    name: {
        type: String,
    },
    slug: {
        type: String,
    },
    show: {
        type: Boolean,
        default: true
    },
    description: {
        type: String
    },
    vendor: {
        type: String
    },
    manufacturer: {
        type: String
    },
    category: {
        type: Array
    },
    prices: [
        {
            type: Object
        }
    ],
    thumb: {
        type: String
    },
    gallery: [
        {
            type: String
        }
    ]
}, {
    versionKey: false
});

const Product = mongoose.model('Product', ProductSchema);
module.exports = Product;
