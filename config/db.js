const mongoose = require('mongoose')

const initDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI)
        console.log('====================================');
        console.log('MongoDB connected:', conn.connection.host);
        console.log('====================================');
    } catch (error) {
        console.log(error);
    }
}

module.exports = initDB