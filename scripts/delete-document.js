const { ConvexHttpClient } = require('convex/browser');

// Read environment variables directly
const fs = require('fs');
const path = require('path');

// Read .env.local file
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key] = value;
  }
});

const convex = new ConvexHttpClient(envVars.NEXT_PUBLIC_CONVEX_URL);

async function deleteDocument() {
  try {
    console.log('🔍 Looking for document with fileId: 1kJR4fY0tr9w4ehidQMuxTXrWER4aS3CM');
    
    // Get the document
    const document = await convex.query('documents:getDocumentByFileId', {
      fileId: '1kJR4fY0tr9w4ehidQMuxTXrWER4aS3CM'
    });
    
    if (!document) {
      console.log('❌ Document not found');
      return;
    }
    
    console.log('📄 Found document:', document._id);
    console.log('📄 Document data:', JSON.stringify(document, null, 2));
    
    // Delete the document
    await convex.mutation('documents:deleteDocument', {
      documentId: document._id
    });
    
    console.log('✅ Document deleted successfully');
    
  } catch (error) {
    console.error('❌ Error deleting document:', error);
    console.error('❌ Error details:', error.message);
  }
}

deleteDocument(); 