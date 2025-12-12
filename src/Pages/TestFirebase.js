// src/Pages/TestFirebase.js
import React, { useState } from 'react';
import { Container, Card, Button, Alert } from 'react-bootstrap';
import { db } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

function TestFirebase() {
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const testConnection = async () => {
    setLoading(true);
    setResult('Testing...');
    
    try {
      // Test 1: Cek apakah db object ada
      console.log('DB Object:', db);
      setResult(prev => prev + '\n✅ DB Object exists');

      // Test 2: Coba baca collection users
      console.log('Fetching users...');
      const usersSnapshot = await getDocs(collection(db, 'users'));
      console.log('Users found:', usersSnapshot.size);
      setResult(prev => prev + `\n✅ Users collection: ${usersSnapshot.size} documents`);

      // Test 3: Coba baca collection projects
      console.log('Fetching projects...');
      const projectsSnapshot = await getDocs(collection(db, 'projects'));
      console.log('Projects found:', projectsSnapshot.size);
      setResult(prev => prev + `\n✅ Projects collection: ${projectsSnapshot.size} documents`);

      // Test 4: List semua users
      const usersList = [];
      usersSnapshot.forEach(doc => {
        usersList.push({ id: doc.id, ...doc.data() });
      });
      console.log('Users list:', usersList);
      setResult(prev => prev + `\n✅ Sample users: ${JSON.stringify(usersList.slice(0, 3), null, 2)}`);

      setResult(prev => prev + '\n\n🎉 All tests passed!');
    } catch (error) {
      console.error('Error:', error);
      setResult(prev => prev + `\n\n❌ Error: ${error.message}`);
      setResult(prev => prev + `\n❌ Error code: ${error.code}`);
      setResult(prev => prev + `\n❌ Full error: ${JSON.stringify(error, null, 2)}`);
    }
    
    setLoading(false);
  };

  const testWrite = async () => {
    setLoading(true);
    setResult('Testing write...');
    
    try {
      const testData = {
        test: 'Hello Firebase',
        timestamp: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'test'), testData);
      console.log('Document written with ID:', docRef.id);
      setResult(prev => prev + `\n✅ Write successful! Doc ID: ${docRef.id}`);
    } catch (error) {
      console.error('Write error:', error);
      setResult(prev => prev + `\n\n❌ Write Error: ${error.message}`);
    }
    
    setLoading(false);
  };

  return (
    <Container className="py-4">
      <Card>
        <Card.Header className="bg-primary text-white">
          <h5 className="mb-0">🔥 Firebase Connection Test</h5>
        </Card.Header>
        <Card.Body>
          <div className="mb-3">
            <Button 
              variant="primary" 
              onClick={testConnection}
              disabled={loading}
              className="me-2"
            >
              {loading ? 'Testing...' : 'Test Read Connection'}
            </Button>
            
            <Button 
              variant="success" 
              onClick={testWrite}
              disabled={loading}
            >
              Test Write Connection
            </Button>
          </div>

          {result && (
            <Alert variant="info">
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                {result}
              </pre>
            </Alert>
          )}

          <Alert variant="warning">
            <strong>Instructions:</strong>
            <ol className="mb-0 mt-2">
              <li>Open Browser Console (F12)</li>
              <li>Click "Test Read Connection"</li>
              <li>Check console for detailed logs</li>
              <li>Check result above</li>
            </ol>
          </Alert>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default TestFirebase;