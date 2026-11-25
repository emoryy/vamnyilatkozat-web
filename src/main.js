import '@fontsource/bricolage-grotesque/latin-ext-600.css';
import '@fontsource/bricolage-grotesque/latin-ext-800.css';
import '@fontsource/bricolage-grotesque/latin-600.css';
import '@fontsource/bricolage-grotesque/latin-800.css';
import '@fontsource/public-sans/latin-ext-400.css';
import '@fontsource/public-sans/latin-ext-600.css';
import '@fontsource/public-sans/latin-400.css';
import '@fontsource/public-sans/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './app.css';

import { mount } from 'svelte';
import App from './App.svelte';
import { init } from './lib/store.svelte.js';

init();
mount(App, { target: document.getElementById('app') });
