// index.js

const mongoose      = require('mongoose');
const mysql         = require('mysql');
const Product       = require('./mongo_models/product');
const Stock         = require('./mongo_models/stock');
const _cliProgress  = require('cli-progress');


const productBar = new _cliProgress.SingleBar({
    format: 'Progress | \x1b[34m{bar} | {percentage}% || {value}/{total} Records\x1b[0m',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});

const stockBar = new _cliProgress.SingleBar({
    format: 'Progress | \x1b[34m{bar} | {percentage}% || {value}/{total} Records\x1b[0m',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});

require('dotenv').config({ path: '.env'} );


var mysqlConnection = null;
var prSuccess = 0, prFail = 0, stockSuccess = 0, stockFail = 0;

function databasesConnect( cb ) {
    mongoose.connect('mongodb://' +
        process.env.MONGO_LOGIN +
        ':' +
        process.env.MONGO_PASS +
        '@localhost:27017/' +
        process.env.MONGO_DB,
        {useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true, reconnectInterval: 500, reconnectTries: 10}).then(res => {
        console.log('\x1b[32mService:\x1b[0m MongoDB connected');
        // Mongo connected

        mysqlConnection = mysql.createConnection({
            host: 'localhost',
            user: process.env.MYSQL_LOGIN,
            password: process.env.MYSQL_PASS,
            database: process.env.MYSQL_DB
            // multipleStatements: true
        });

        mysqlConnection.connect((err) => {
            if( err ) {
                console.log('\x1b[31mService:\x1b[0m MySQL failed');
                console.log(err);
                process.exit(-1);
            } else {
                cb( );
            }
        })

    }).catch(err => {
        if (err) {
            console.log('\x1b[31mService:\x1b[0m MongoDB failed');
            console.log(err.stack);
        }
        process.exit(-1);
    });
}


// LOGIC
function escapeString( string ){
    return string.replace(/(['"])/g, "\\$1");
}

function reflect( promise ) {
    return promise.then(
        (v) => {return {value: v, status: 'resolved'};},
        (e) => {return {value: e, status: 'rejected'};},);
}

/*

function processSinglePriceUnit( prID, prType, unitID, cost ) {
    mysqlConnection.query(`INSERT INTO prices (organisation_id, product_id, unit_id, cost) VALUES ('${prType}', '${prID}', '${unitID}', ${cost})`, (priceErr, priceRes) => {
        if( priceErr ){
            console.log('\x1b[31mFailed price in product \x1b[0mID: ', prID);
            console.log("ERROR: ", priceErr);
        }
    });
}

function* pricesListGenerator( prID, prType, prices ) {
    for( let priceIndex = 0; priceIndex < prices.length; priceIndex++ ){
        yield processSinglePriceUnit( prID, prType, prices[priceIndex].unit, prices[priceIndex].cost );
    }
}

function* prTypeListGenerator( prices, prID ) {
    for( let orgIndex = 0; orgIndex < prices.length; orgIndex++ ){
        yield* pricesListGenerator( prID, prices[orgIndex].type, prices[orgIndex].prices );
    }
}

function processSingleProduct( product, index ){
    mysqlConnection.query(`INSERT INTO product (product_id, name, slug, vendor, description) VALUES ('${product.id}', '${escapeString(product.name)}', '${escapeString(product.slug).toLowerCase()||''}', '${escapeString(product.vendor).toLowerCase()||''}', '${escapeString(product.description).toLowerCase()||''}')`, (perr, pres) => {
        if( perr ){
            console.log('\x1b[31mFailed product. \x1b[0mID: ', product.id);
            console.log("ERROR: ", perr);
            console.log(`VALUES ('${product.id}', '${escapeString(product.name)}', '${escapeString(product.slug).toLowerCase()||''}', '${escapeString(product.vendor).toLowerCase()||''}', '${escapeString(product.description).toLowerCase()||''}')`);
            prFail++;
        } else {
            for( let priceProcess of prTypeListGenerator( product.prices, product.id ) ){
                // here process product price list
            }
            prSuccess++;
        }
    });
    productBar.update( index + 1 );
}

function* taskGenerator( products, amount ) {
    for( let index = 0; index < amount; index++ ) {
        yield processSingleProduct( products[index], index );
    }
}

 */

function getProductsData( cb ){
    Product.countDocuments({}, (err, amount) => {
        if( err ){
            console.log('\x1b[31mERR:\x1b[0m ', err.message);
            process.exit(-1);
        }
        console.log('\n\x1b[32mProducts processing...\x1b[0m ');
        productBar.start(amount, 0);

        Product.find({}, async (perr, products) => {
            if( perr ){
                console.log('\x1b[31mERR:\x1b[0m ', perr.message);
                process.exit(-1);
            }
            cb(products, amount);
        });
    });
}

function processProducts( cb ) {
    getProductsData( async (products, amount) => {

        let prCounter = 0;
        productBar.start(amount, prCounter);

        for( let product of products ) {
            prCounter++;
            await mysqlConnection.query(`INSERT INTO product (product_id, name, slug, vendor, description) VALUES ('${product.id}', '${escapeString(product.name)}', '${escapeString(product.slug).toLowerCase()||''}', '${escapeString(product.vendor).toLowerCase()||''}', '${escapeString(product.description).toLowerCase()||''}')`);

            for( let comPrices of product.prices ){
                for( let unitPrice of comPrices.prices ){
                    await mysqlConnection.query(`INSERT INTO prices (organisation_id, product_id, unit_id, cost) VALUES ('${comPrices.type}', '${product.id}', '${unitPrice.unit}', ${unitPrice.cost})`);
                }
            }
            productBar.update( prCounter );
        }
        // for(let task of taskGenerator(products, amount)) {
        //     // console.log('Task: ', task);
        // }
        productBar.stop();
        cb();
    });
}

function processStock( cb ) {
    Stock.countDocuments({}, (err, amount) => {
        if( err ){
            console.log('\x1b[31mERR:\x1b[0m ', err.message);
            process.exit(-1);
        }
        console.log('\n\x1b[32mStocks processing...\x1b[0m ');
        stockBar.start(amount, 0);

        Stock.find({}, (stockErr, stocksRes) => {
            if( stockErr ){
                console.log('\x1b[31mErr:\x1b[0m ', stockErr.message);
                process.exit(-1);
            }

            Promise.all(stocksRes.map((warehouse, warehouseIndex) => {
                return reflect( new Promise((warehouseResolve) => {
                    Promise.all( warehouse.stock.map((stock, stockIndex) => {
                        return reflect( new Promise((stockResolve, stockReject) => {
                            mysqlConnection.query(`INSERT INTO stock (unit_id, product_id, warehouse_id, amount) VALUES ('${stock.unit}', '${warehouse.product}', '${warehouse.warehouse}', ${stock.amount})`, (stockErr, stockRes) => {
                                stockBar.update(warehouseIndex+1);
                                if( stockErr ){
                                    stockFail++;
                                    stockReject(`'${stock.unit}'`);
                                } else {
                                    stockSuccess++;
                                    stockResolve(`'${stock.unit}'`);
                                }
                            });
                        }));
                    })).then(() => warehouseResolve(`'${warehouse.warehouse}'`));
                }));
            })).then(() => {
                stockBar.stop();
                cb();
            });
        });
    });
}


databasesConnect( () => {
    console.log('\x1b[32mService:\x1b[0m MySQL connected');
    console.log('\x1b[32m-----------------------------------\x1b[0m');

    processProducts( () => {
        console.log('Products successfully processed: ', prSuccess);
        console.log('Products failed: ', prFail);
        processStock( () => {
            console.log('Warehouses successfully processed: ', stockSuccess);
            console.log('Warehouses failed: ', stockFail);
            process.exit(0);
        });
    } );
});
