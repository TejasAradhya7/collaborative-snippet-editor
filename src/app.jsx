import React, { useState, useEffect } from 'react';

// --- Firebase Imports (Crucial for collaboration) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, serverTimestamp } from 'firebase/firestore';

// --- CodeMirror Imports (For the Code Editor) ---
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark'; // Use a dark theme for code

// --- Global Variable Setup (Mandatory for Canvas Environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-collaboration-app';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Helper to determine the Firestore path for public collaboration data
const getSnippetDocRef = (db, snippetId) => {
    // Public data path: /artifacts/{appId}/public/data/{collection}/{documentId}
    return doc(db, 'artifacts', appId, 'public', 'data', 'snippets', snippetId);
};

// --- Main Application Component ---
const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [snippetId, setSnippetId] = useState('welcome-snippet'); // Default room ID
    const [code, setCode] = useState('// Start writing your collaborative code here!\n\nfunction helloWorld() {\n  return "Hello, Collaborator!";\n}');
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState('Initializing...');
    const [isInitialized, setIsInitialized] = useState(false);

    // 1. Initialize Firebase and Auth
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Handle Authentication (Use custom token if available, otherwise sign in anonymously)
            const authenticate = async () => {
                if (initialAuthToken) {
                    await signInWithCustomToken(firebaseAuth, initialAuthToken);
                } else {
                    await signInAnonymously(firebaseAuth);
                }
            };
            
            // Listen for auth state changes to get the current user ID
            onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setStatus(`Authenticated as: ${user.uid.substring(0, 8)}...`);
                    setIsInitialized(true);
                } else {
                    setUserId(null);
                    setStatus('Authentication failed.');
                }
            });
            
            authenticate();

        } catch (e) {
            console.error("Firebase Initialization Error:", e);
            setStatus('Error: Could not initialize Firebase.');
        }
    }, []);

    // 2. Real-Time Data Synchronization (onSnapshot)
    useEffect(() => {
        if (!db || !userId) return;

        setStatus(`Subscribing to room: ${snippetId}`);

        const snippetRef = getSnippetDocRef(db, snippetId);

        // Set up the real-time listener
        const unsubscribe = onSnapshot(snippetRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                // Only update the code if the change wasn't just caused by us saving
                if (!isSaving && data.content) {
                    setCode(data.content);
                    setStatus(`Real-time update received in room: ${snippetId}`);
                }
            } else {
                // If the snippet doesn't exist, create it with initial content
                handleSaveCode(code, false); // Save current code as initial content
                setStatus(`New collaboration room created: ${snippetId}`);
            }
        }, (error) => {
            console.error("Firestore Listener Error:", error);
            setStatus(`Error loading room ${snippetId}.`);
        });

        // Cleanup function for the listener
        return () => unsubscribe();
    }, [db, userId, snippetId]); // Re-run effect if db, user, or room ID changes
    
    // 3. Debounced Save Logic (Write to Firestore)
    const handleSaveCode = async (newCode, debounce = true) => {
        if (!db || !userId) return;
        setCode(newCode); // Update local state immediately

        // Use a debounce function in a real app to limit write operations, 
        // but for simplicity here, we'll use a direct save after a slight delay
        
        if (debounce) {
            // Placeholder for a true debouncer (e.g., use lodash.debounce or custom hook)
            clearTimeout(window.saveTimer);
            window.saveTimer = setTimeout(() => {
                saveToFirestore(newCode);
            }, 1000); // Wait 1 second after typing stops
        } else {
             // Immediate save for initial creation
             await saveToFirestore(newCode);
        }
    };
    
    const saveToFirestore = async (content) => {
        const snippetRef = getSnippetDocRef(db, snippetId);
        setIsSaving(true);
        setStatus(`Saving changes to Firestore...`);
        
        try {
            await setDoc(snippetRef, {
                content: content,
                lastEditedBy: userId,
                timestamp: serverTimestamp(),
            }, { merge: true }); // Use merge to avoid overwriting the whole document
            
            setStatus(`Changes saved successfully to room: ${snippetId}`);
        } catch (e) {
            console.error("Error saving document:", e);
            setStatus('Error: Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };

    // 4. Handle Room ID change
    const handleRoomChange = (e) => {
        const newId = e.target.value.trim();
        // Simple validation to prevent empty ID or path traversal issues
        if (newId && newId.length < 50 && newId.match(/^[a-z0-9-]+$/i)) {
             setSnippetId(newId);
        } else {
             // Use a custom modal instead of alert()
             setStatus('Room ID must be alphanumeric/hyphenated and non-empty.');
        }
    };

    if (!isInitialized) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-900 text-green-400">
                <p>Loading Authentication and Dependencies...</p>
            </div>
        );
    }
    
    // --- Render Component ---
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col p-4 md:p-8">
            <header className="text-center mb-6">
                <h1 className="text-4xl font-extrabold text-green-400">Code Sync</h1>
                <p className="text-gray-400 mt-1">Real-Time Collaborative Code Editor</p>
                <p className="text-xs text-green-500 mt-2">
                    <span className="font-bold">Your User ID:</span> {userId}
                </p>
            </header>

            {/* Status Bar */}
            <div className={`p-2 text-sm rounded-lg mb-4 ${isSaving ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-800 text-gray-400'}`}>
                {status}
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <label className="flex-grow flex items-center bg-gray-700 rounded-lg p-2">
                    <span className="text-sm font-medium mr-2 text-gray-300">Room ID:</span>
                    <input
                        type="text"
                        value={snippetId}
                        onChange={(e) => setSnippetId(e.target.value)} // Local change for input box
                        onBlur={handleRoomChange} // Actual room change on blur
                        className="flex-grow p-1 rounded-md bg-gray-600 border border-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 text-white text-sm"
                        placeholder="e.g., my-project-room"
                    />
                </label>
                
                {/* Share Button (Simulated Copy Link) */}
                <button
                    onClick={() => {
                        // In a deployed app, you'd use navigator.clipboard.writeText(window.location.href);
                        // Here, we copy the room ID for sharing.
                        document.execCommand('copy', false, snippetId);
                        setStatus(`Room ID "${snippetId}" copied! Share it to collaborate.`);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
                >
                    Copy Room ID
                </button>
            </div>

            {/* Code Editor */}
            <div className="flex-grow rounded-xl overflow-hidden shadow-2xl">
                <CodeMirror
                    value={code}
                    height="70vh" // Give it a fixed height
                    theme={oneDark}
                    extensions={[javascript({ jsx: true })]}
                    onChange={handleSaveCode} // Trigger debounce save on every change
                    options={{
                        keyMap: 'sublime',
                        mode: 'javascript',
                    }}
                />
            </div>
            
            <footer className="mt-4 text-center text-xs text-gray-600">
                Data saved in Firestore under: /artifacts/{appId}/public/data/snippets/{snippetId}
            </footer>
        </div>
    );
};

export default App;
