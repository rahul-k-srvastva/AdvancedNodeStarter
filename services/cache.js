const mongoose = require("mongoose");
const redis = require("redis");
const util = require("util");
const keys = require("../config/keys");

const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}){
    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || "" ); 
    return this;
}

mongoose.Query.prototype.exec = async function(){
    console.log("IM ABOUT TO RUN A QUERY");

    if(!this.useCache) return exec.apply(this,arguments);

    // const key = Object.assign({},this.getQuery(),{
    //     collection : this.mongooseCollection.name
    // });

    const qryObj = this.getQuery();
    // console.log(qryObj._id);
    if(qryObj._id) qryObj._id = qryObj._id.toString();

    const key = JSON.stringify({...qryObj , collection : this.mongooseCollection.name  });

    const cacheValue = await client.hget(this.hashKey , key);

    if(cacheValue){
        const doc = JSON.parse(cacheValue);
        return Array.isArray(doc) ? doc.map(d=> new this.model(d)) : new this.model(doc);
    }

    const result = await exec.apply(this, arguments);

    client.hset(this.hashKey , key , JSON.stringify(result) , 'EX' , 10);

    return result;

}

exports.clearHash = (hashKey)=>{
    client.del(JSON.stringify(hashKey));
}