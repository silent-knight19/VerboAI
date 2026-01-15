/*
================================================================================
MAIN ENTRY POINT (main.jsx)
================================================================================
ROLE: This is where our React application starts.
WHY:  Every React app needs an entry point that renders the root component.
HOW:  We find the "root" div in index.html and render our <App /> into it.
================================================================================

EXECUTION ORDER:
1. Browser loads index.html
2. index.html loads this file (main.jsx)
3. This file renders <App /> into the #root div
4. React takes over from there
================================================================================
*/

// =============================================================================
// IMPORTS
// =============================================================================

/*
  StrictMode - A React wrapper for catching potential problems
  
  ROLE: Helps find bugs during development
  WHY:  It runs certain checks twice to catch side effects
        It warns about deprecated features
  HOW:  Wrap your app in <StrictMode>...</StrictMode>
  
  NOTE: StrictMode only affects development builds, not production!
        It intentionally double-renders components to catch bugs
*/
import { StrictMode } from 'react';

/*
  createRoot - New way to render React apps (React 18+)
  
  ROLE: Creates a "root" that React will manage
  WHY:  React 18 introduced a new way to render for better performance
        (The old way was ReactDOM.render(), now deprecated)
  HOW:  createRoot(element).render(<YourComponent />)
*/
import { createRoot } from 'react-dom/client';

/*
  './index.css' - Global CSS styles
  
  ROLE: Applies base styles to the entire app
  WHY:  Some styles should apply everywhere (fonts, reset, etc.)
  HOW:  Importing a CSS file in React adds it to the page
  
  NOTE: This file exists in the same folder (src/)
        It might include things like:
        - CSS reset/normalize
        - Global font settings
        - Body background color
*/
import './index.css';

/*
  App - Our main application component
  
  ROLE: The root component containing our entire app
  WHY:  We need to render SOMETHING into the #root div
  HOW:  We import it and use it like <App />
*/
import App from './App.jsx';


// =============================================================================
// MOUNTING THE APP
// =============================================================================

/*
  Step 1: Find the root element
  
  ROLE: Get a reference to the div where React will render
  WHY:  React needs to know WHERE to put our app in the HTML
  HOW:  document.getElementById looks for an element with id="root"
        This div exists in index.html: <div id="root"></div>
*/
const rootElement = document.getElementById('root');

/*
  Step 2: Create a React root
  
  ROLE: Tell React "this is where you'll render the app"
  WHY:  React 18 requires this step (it's how concurrent features work)
  HOW:  createRoot returns an object with a render() method
*/
const root = createRoot(rootElement);

/*
  Step 3: Render our app
  
  ROLE: Actually put our App component on the page
  WHY:  This starts the React application
  HOW:  root.render() takes JSX and inserts it into the root element
  
  WHAT HAPPENS:
  1. React evaluates <App />
  2. App() function runs, returning JSX
  3. React converts JSX to actual DOM elements
  4. DOM elements are inserted into #root
  5. Our app is now visible on the page!
*/
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

/*
  WHY STRICTMODE?
  
  StrictMode wraps our entire app and provides extra checks:
  
  1. DOUBLE RENDERING:
     - In development, components render twice
     - This helps find side effects that shouldn't happen
     - Example: if you accidentally modify external data during render
  
  2. DEPRECATION WARNINGS:
     - Warns about using outdated APIs
     - Helps keep code up-to-date
  
  3. FUTURE-PROOFING:
     - Prepares your app for future React features
  
  NOTE: This only happens in development mode!
        Production builds don't have these extra checks
*/
