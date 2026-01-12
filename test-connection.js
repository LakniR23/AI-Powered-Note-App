const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://Lakni:Lakni23@cluster0.gsaq3bj.mongodb.net/ai-powered-app?retryWrites=true&w=majority';

async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Successfully connected to MongoDB!');
    console.log('Database name:', mongoose.connection.db.databaseName);
    
    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections in database:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    // Check if person collection exists and count documents
    const Person = mongoose.connection.db.collection('people');
    const count = await Person.countDocuments();
    console.log(`\nTotal documents in 'people' collection: ${count}`);
    
    if (count > 0) {
      console.log('\nSample documents:');
      const docs = await Person.find().limit(3).toArray();
      docs.forEach(doc => {
        console.log(`  - ${doc.firstName} ${doc.lastName}`);
      });
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Connection test completed successfully!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
