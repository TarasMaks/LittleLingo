import React from 'react';
import {createRoot} from 'react-dom/client';
import LearningApp from './app/learning-app';
import './app/globals.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><LearningApp/></React.StrictMode>);
