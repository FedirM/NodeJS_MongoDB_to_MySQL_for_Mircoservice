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

function processProducts( cb ){
    Product.countDocuments({}, (err, amount) => {
        if( err ){
            console.log('\x1b[31mERR:\x1b[0m ', err.message);
            process.exit(-1);
        }
        console.log('\n\x1b[32mProducts processing...\x1b[0m ');
        productBar.start(amount, 0);

        Product.find({}, (perr, products) => {
            if( perr ){
                console.log('\x1b[31mERR:\x1b[0m ', perr.message);
                process.exit(-1);
            }
            Promise.all(products.map((product, index) => {

                return reflect(new Promise( ((resolve, reject) => {
                    console.log('\n #### QUERY #### \n\n', `INSERT INTO product (product_id, original_name, name, slug, vendor, description) VALUES ('${product.id}', '${escapeString(product.name)}', '${escapeString(product.name).toLowerCase()}', '${escapeString(product.slug).toLowerCase()}', '${escapeString(product.vendor).toLowerCase()}', '${escapeString(product.description).toLowerCase()}')`);
                    mysqlConnection.query(`INSERT INTO product (product_id, original_name, name, slug, vendor, description) VALUES ('${product.id}', '${escapeString(product.name)}', '${escapeString(product.name).toLowerCase()}', '${escapeString(product.slug).toLowerCase()}', '${escapeString(product.vendor).toLowerCase()}', '${escapeString(product.description).toLowerCase()}')`, (perr, pres) => {
                        productBar.update( index + 1 );
                        if( perr ){
                            // console.log('\x1b[31mFailed product. \x1b[0mID: ', product.id);
                            // console.log("ERROR: ", perr);
                            prFail++;
                            reject( product );
                        } else {
                            Promise.all( product.prices.map((organization, organisationIndex) => {
                                return reflect( new Promise((resolveOrg) => {
                                    Promise.all( organization.prices.map((price, priceIndex) => {
                                        return reflect( new Promise( (resolvePrice, rejectPrice) => {
                                            mysqlConnection.query(`INSERT INTO prices (organisation_id, product_id, unit_id, cost) VALUES ('${organization.type}', '${product.id}', '${price.unit}', ${price.cost})`, (priceErr, priceRes) => {
                                                if( priceErr ){
                                                    rejectPrice( null );
                                                } else {
                                                    resolvePrice( price );
                                                }
                                            });
                                        }));
                                    })).then(() => {resolveOrg(organization);});
                                }));
                            })).then(() => {
                                prSuccess++;
                                resolve( product );
                            });
                        }
                    })
                })));
            })).then((res) => {
                productBar.stop();
                cb();
                // process.exit(0);
            });
        })
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
