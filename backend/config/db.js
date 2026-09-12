const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eventhub';
  mongoose.set('strictQuery', true);

  // Mongo is started alongside Node by supervisord, so it may not be listening
  // yet on the first attempt. Retry rather than crash the container.
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log('MongoDB connected');
      return;
    } catch (err) {
      console.error(`MongoDB connection attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      if (attempt === maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

module.exports = connectDB;
